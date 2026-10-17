/**
 * lib/googleSheets.ts
 *
 * Utility to authenticate with Google Sheets API via a Service Account
 * and append a row with Vapi call data.
 */

import { google, sheets_v4 } from "googleapis";
import { formatInAppTimeZone } from "@/lib/time";

// Google Sheets rejects the whole append if any cell exceeds 50,000
// characters, which a long call's transcript can. The full transcript is
// always kept in MongoDB; the sheet gets a truncated copy.
const MAX_CELL_CHARS = 49_000;

function truncateForCell(value: string): string {
  if (value.length <= MAX_CELL_CHARS) return value;
  return value.slice(0, MAX_CELL_CHARS) + "\n…[truncated — full transcript in the admin dashboard]";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallRecord {
  /** ISO-8601 timestamp when the row was written — Column A: Date & Time */
  timestamp: string;
  /** Caller's name if known, otherwise empty — Column B: Caller Name */
  callerName: string;
  /** E.164 format phone number, e.g. "+14155551234" — Column C: Phone Number */
  callerNumber: string;
  /** Course or topic the caller was interested in — Column D: Interested Course */
  interestedCourse: string;
  /** AI-generated summary of the call — Column E: Call Summary */
  summary: string;
  /** Full verbatim transcript of the call — Column F: Full Transcript */
  transcript: string;
  /** Caller's academic marks / percentage — Column G: Academic Marks */
  academicMarks: string;
  /** Whether the caller requires hostel accommodation — Column H: Hostel Required */
  hostelRequired: string;
  /** Caller's current location / city — Column I: Location */
  location: string;
  /** Agreed next action / follow-up step — Column J: Next Action */
  nextAction: string;
  /** Who called: student / parent / other — Column K: Caller Role */
  callerRole: string;
  /** hot / warm / cold — Column L: Lead Temperature */
  leadTemperature: string;
  /** When the caller wants to be called back — Column M: Preferred Callback Time */
  preferredCallbackTime: string;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

/**
 * Builds a JWT-authenticated Google API client from environment variables.
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   – service account email
 *   GOOGLE_PRIVATE_KEY             – private key (newlines as \n literals)
 */
function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Missing Google Service Account credentials. " +
        "Ensure GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are set."
    );
  }

  // .env files store newlines as the literal string \n – unescape them.
  const privateKey = rawKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Appends one row to the configured Google Sheet.
 *
 * Column layout (A → M) — must match the sheet header row:
 *   A – Date & Time       (ISO-8601 timestamp)
 *   B – Caller Name       (empty if unknown)
 *   C – Phone Number      (E.164 format)
 *   D – Interested Course (extracted from call context)
 *   E – Call Summary
 *   F – Full Transcript
 *   G – Academic Marks    (e.g. "85%" or "CGPA 8.5")
 *   H – Hostel Required   (e.g. "Yes" / "No" / "Unknown")
 *   I – Location          (caller's city or region)
 *   J – Next Action       (agreed follow-up step)
 *   K – Caller Role       (student / parent / other)
 *   L – Lead Temperature  (hot / warm / cold)
 *   M – Preferred Callback Time
 *
 * Required env vars (in addition to auth vars above):
 *   GOOGLE_SHEET_ID    – the spreadsheet ID from the Sheet URL
 *   GOOGLE_SHEET_NAME  – the tab name, e.g. "Sheet1"
 */
export async function appendCallRecord(record: CallRecord): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME ?? "Call Logs";

  if (!sheetId) {
    throw new Error(
      "Missing GOOGLE_SHEET_ID environment variable."
    );
  }

  const auth = getAuthClient();
  const sheetsClient: sheets_v4.Sheets = google.sheets({
    version: "v4",
    auth,
  });

  // If sheetName contains spaces or special chars, single-quote it.
  // The tab name must EXACTLY match what exists in the spreadsheet.
  const escapedName = sheetName.replace(/'/g, "\\'");
  const range = `'${escapedName}'!A:M`;

  // Values must be in the same order as the sheet columns (A → M):
  // A: Date & Time | B: Caller Name  | C: Phone Number    | D: Interested Course
  // E: Call Summary | F: Full Transcript | G: Academic Marks
  // H: Hostel Required | I: Location | J: Next Action
  // K: Caller Role | L: Lead Temperature | M: Preferred Callback Time
  const values: string[][] = [
    [
      formatInAppTimeZone(record.timestamp, { dateStyle: "medium", timeStyle: "short" }),
      record.callerName,
      record.callerNumber,
      record.interestedCourse,
      record.summary,
      truncateForCell(record.transcript),
      record.academicMarks,
      record.hostelRequired,
      record.location,
      record.nextAction,
      record.callerRole,
      record.leadTemperature,
      record.preferredCallbackTime,
    ],
  ];

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range,
    // RAW, not USER_ENTERED: these values come from callers and an LLM, so
    // anything starting with "=" must stay text rather than run as a formula,
    // and "+91…" numbers must not be parsed into plain numbers.
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}

/**
 * Verifies the service account can reach the configured spreadsheet,
 * without writing any data — used by the /api/test-sheets health check so
 * it doesn't leave a fake row behind every time it's hit.
 */
export async function verifySheetAccess(): Promise<{ title: string }> {
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID environment variable.");
  }

  const auth = getAuthClient();
  const sheetsClient: sheets_v4.Sheets = google.sheets({ version: "v4", auth });

  const { data } = await sheetsClient.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "properties.title",
  });

  return { title: data.properties?.title ?? "Untitled spreadsheet" };
}
