/**
 * app/api/test-mongodb/route.ts
 *
 * Quick connectivity test — inserts a test call record into MongoDB
 * and returns success/failure. DELETE this route before going to production.
 */

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import CallRecordModel from "@/models/CallRecord";

export async function GET(): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const doc = await CallRecordModel.create({
      timestamp: new Date(),
      callerName: "Test User",
      callerNumber: "+10000000000",
      interestedCourse: "BBA",
      summary: "✅ TEST ROW — connection verified successfully.",
      transcript: "This is a test entry created by the /api/test-mongodb health check.",
      academicMarks: "N/A",
      hostelRequired: "N/A",
      location: "N/A",
      nextAction: "N/A",
    });

    return NextResponse.json(
      {
        success: true,
        message: "✅ Test document inserted into MongoDB successfully!",
        id: doc._id,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[test-mongodb] Error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
