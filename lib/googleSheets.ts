/**
 * lib/googleSheets.ts
 *
 * Utility to authenticate with Google Sheets API via a Service Account
 * and append a row with Vapi call data.
 */

import { google, sheets_v4 } from "googleapis";

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
 * Column layout (A → F) — must match the sheet header row:
 *   A – Date & Time  (ISO-8601 timestamp)
 *   B – Caller Name  (empty if unknown)
 *   C – Phone Number (E.164 format)
 *   D – Interested Course (extracted from call context)
 *   E – Call Summary
 *   F – Full Transcript
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
  const range = `'${escapedName}'!A:F`;

  // Values must be in the same order as the sheet columns (A → F):
  // A: Date & Time | B: Caller Name | C: Phone Number
  // D: Interested Course | E: Call Summary | F: Full Transcript
  const values: string[][] = [
    [
      record.timestamp,
      record.callerName,
      record.callerNumber,
      record.interestedCourse,
      record.summary,
      record.transcript,
    ],
  ];

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}
