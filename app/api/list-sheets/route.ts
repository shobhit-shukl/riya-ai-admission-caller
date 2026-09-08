/**
 * app/api/list-sheets/route.ts
 *
 * Diagnostic route — lists all sheet tab names in the configured spreadsheet.
 * DELETE before production.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) throw new Error("Missing credentials");
  const privateKey = rawKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function GET(): Promise<NextResponse> {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("Missing GOOGLE_SHEET_ID");

    const auth = getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.get({ spreadsheetId: sheetId });

    const tabNames = res.data.sheets?.map((s) => s.properties?.title) ?? [];

    return NextResponse.json({ success: true, tabs: tabNames }, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
