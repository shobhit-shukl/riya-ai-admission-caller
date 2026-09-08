/**
 * app/api/test-sheets/route.ts
 *
 * Quick connectivity test — appends a test row to the Google Sheet
 * and returns success/failure. DELETE this route before going to production.
 */

import { NextResponse } from "next/server";
import { appendCallRecord } from "@/lib/googleSheets";

export async function GET(): Promise<NextResponse> {
  try {
    await appendCallRecord({
      timestamp: new Date().toISOString(),
      callerName: "Test User",
      callerNumber: "+10000000000",
      interestedCourse: "BBA",
      summary: "✅ TEST ROW — connection verified successfully.",
      transcript: "This is a test entry created by the /api/test-sheets health check.",
    });

    return NextResponse.json(
      { success: true, message: "✅ Test row appended to Google Sheet successfully!" },
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
