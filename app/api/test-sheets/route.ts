/**
 * app/api/test-sheets/route.ts
 *
 * Quick connectivity test — verifies the service account can reach the
 * configured spreadsheet, without appending any row. Admin-only, and
 * deliberately avoids writing: anything it inserted would show up as a
 * fake lead in the sheet.
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { verifySheetAccess } from "@/lib/googleSheets";

export async function GET(): Promise<NextResponse> {
  // Admin-only: the error messages below reveal infrastructure details.
  if (!(await getAdminSession())) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

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
