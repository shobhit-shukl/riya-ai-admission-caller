/**
 * lib/contactImport.ts
 *
 * Turns an uploaded .xlsx or .csv file into call-list contacts.
 *
 * Columns are found from the header row ("Name" / "Student Name",
 * "Phone" / "Mobile" / "Contact Number", optional "Course"). A file
 * without a recognisable header is read row by row: the first cell with
 * 10+ digits is the phone, the first other text cell is the name.
 * Rows without a callable number are skipped and reported back.
 */

import { readSheet } from "read-excel-file/node";
import { connectToDatabase } from "@/lib/mongodb";
import { phoneKey } from "@/lib/leadPipeline";
import { toE164 } from "@/lib/outboundCalls";
import ContactModel from "@/models/Contact";

export const MAX_UPLOAD_BYTES = 1024 * 1024; // Server Actions accept up to 1 MB by default.
export const MAX_CONTACT_ROWS = 5000;

const NAME_HEADERS = ["name", "studentname", "fullname", "student", "candidatename", "candidate", "parentname"];
const PHONE_HEADERS = [
  "phone",
  "phonenumber",
  "phoneno",
  "mobile",
  "mobilenumber",
  "mobileno",
  "contact",
  "contactnumber",
  "contactno",
  "number",
  "whatsapp",
  "whatsappnumber",
  "cell",
];
const COURSE_HEADERS = ["course", "interestedcourse", "program", "programme", "stream", "branch"];

type Cell = string | number | boolean | Date | null | undefined;

interface ParsedContact {
  name: string;
  phone: string;
  course: string;
}

export interface ImportSummary {
  added: number;
  updated: number;
  skipped: { row: number; reason: string }[];
}

function cellText(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // Excel stores most phone numbers as numbers; String() keeps all digits for anything below 2^53.
  return String(value).trim();
}

function headerKey(value: Cell): string {
  return cellText(value).toLowerCase().replace(/[^a-z]/g, "");
}

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF, UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function findColumn(header: Cell[], candidates: string[]): number {
  const keys = header.map(headerKey);
  // Exact matches first ("phone"), then contains ("primary phone").
  const exact = keys.findIndex((key) => candidates.includes(key));
  if (exact !== -1) return exact;
  return keys.findIndex((key) => key !== "" && candidates.some((candidate) => key.includes(candidate)));
}

/**
 * Maps raw rows to contacts. Row numbers in `skipped` are 1-based
 * spreadsheet rows, so they match what the admin sees in Excel.
 */
export function rowsToContacts(rows: Cell[][]): { contacts: ParsedContact[]; skipped: ImportSummary["skipped"] } {
  const skipped: ImportSummary["skipped"] = [];
  const contacts: ParsedContact[] = [];
  if (rows.length === 0) return { contacts, skipped };

  const header = rows[0];
  const phoneCol = findColumn(header, PHONE_HEADERS);
  const hasHeader = phoneCol !== -1;
  const nameCol = hasHeader ? findColumn(header, NAME_HEADERS) : -1;
  const courseCol = hasHeader ? findColumn(header, COURSE_HEADERS) : -1;
  const firstDataRow = hasHeader ? 1 : 0;

  for (let i = firstDataRow; i < rows.length; i++) {
    const cells = rows[i].map(cellText);
    if (cells.every((cell) => cell === "")) continue;

    let phone: string;
    let name: string;
    let course = "";

    if (hasHeader) {
      phone = cells[phoneCol] ?? "";
      name = nameCol !== -1 ? (cells[nameCol] ?? "") : "";
      course = courseCol !== -1 ? (cells[courseCol] ?? "") : "";
    } else {
      const phoneIndex = cells.findIndex((cell) => cell.replace(/\D/g, "").length >= 10);
      phone = phoneIndex !== -1 ? cells[phoneIndex] : "";
      name = cells.find((cell, index) => index !== phoneIndex && /[a-z]/i.test(cell)) ?? "";
    }

    if (!phone) {
      skipped.push({ row: i + 1, reason: "no phone number" });
    } else if (!toE164(phone) || !phoneKey(phone)) {
      skipped.push({ row: i + 1, reason: `"${phone.slice(0, 20)}" isn't a valid phone number` });
    } else {
      contacts.push({ name: name.slice(0, 100), phone: phone.slice(0, 30), course: course.slice(0, 100) });
    }
  }

  return { contacts, skipped };
}

async function readRows(file: File): Promise<Cell[][]> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv")) return parseCsv(await file.text());
  if (lowerName.endsWith(".xlsx")) {
    return (await readSheet(Buffer.from(await file.arrayBuffer()))) as Cell[][];
  }
  throw new Error("Please upload an .xlsx or .csv file. (Old .xls files: open in Excel and Save As .xlsx.)");
}

/** Reads the file and upserts its contacts by phone number. Throws with a user-facing message on bad input. */
export async function importContactsFile(file: File): Promise<ImportSummary> {
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("The file is larger than 1 MB. Split it into smaller files.");

  let rows: Cell[][];
  try {
    rows = await readRows(file);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    throw new Error(message.startsWith("Please upload") ? message : "Couldn't read that file. Is it a valid .xlsx or .csv?");
  }

  if (rows.length > MAX_CONTACT_ROWS + 1) {
    throw new Error(`The file has more than ${MAX_CONTACT_ROWS} rows. Split it into smaller files.`);
  }

  const { contacts, skipped } = rowsToContacts(rows);

  // The same number twice in one file: the later row wins.
  const byKey = new Map<string, ParsedContact>();
  for (const contact of contacts) byKey.set(phoneKey(contact.phone)!, contact);

  if (byKey.size === 0) return { added: 0, updated: 0, skipped };

  await connectToDatabase();
  const source = file.name.slice(0, 120);
  const result = await ContactModel.bulkWrite(
    [...byKey.entries()].map(([key, contact]) => ({
      updateOne: {
        filter: { phoneKey: key },
        update: {
          $set: {
            phone: contact.phone,
            source,
            // Don't blank out a name/course we already have if this file lacks one.
            ...(contact.name ? { name: contact.name } : {}),
            ...(contact.course ? { course: contact.course } : {}),
          },
          $setOnInsert: { status: "new", callAttempts: 0 },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  return {
    added: result.upsertedCount,
    updated: byKey.size - result.upsertedCount,
    skipped,
  };
}
