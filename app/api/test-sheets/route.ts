/**
 * app/api/test-sheets/route.ts
 *
 * Quick connectivity test — verifies the service account can reach the
 * configured spreadsheet, without appending any row. Deliberately avoids
 * writing: this endpoint is public and unauthenticated, so anything it
 * inserted would show up as a fake lead in the sheet.
 */

import { NextResponse } from "next/server";
import { verifySheetAccess } from "@/lib/googleSheets";

export async function GET(): Promise<NextResponse> {
  try {
    const { title } = await verifySheetAccess();

    return NextResponse.json(
      { success: true, message: `✅ Google Sheets connection verified successfully (${title}).` },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[test-sheets] Error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
