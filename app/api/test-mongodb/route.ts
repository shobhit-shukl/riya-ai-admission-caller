/**
 * app/api/test-mongodb/route.ts
 *
 * Quick connectivity test — pings the database and returns success/failure.
 * Admin-only. Deliberately does NOT write any document: anything it
 * inserted (even repeated manual checks) would otherwise show up as a
 * fake lead on the admin dashboard.
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET(): Promise<NextResponse> {
  // Admin-only: the error messages below reveal infrastructure details.
  if (!(await getAdminSession())) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const conn = await connectToDatabase();

    if (!conn.connection.db) {
      throw new Error("Connected, but no database handle is available.");
    }

    await conn.connection.db.admin().ping();

    return NextResponse.json(
      { success: true, message: "✅ MongoDB connection verified successfully." },
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
