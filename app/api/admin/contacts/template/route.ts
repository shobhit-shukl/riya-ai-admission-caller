/**
 * GET /api/admin/contacts/template
 *
 * A sample call-list file showing the columns the Call list upload expects.
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

const SAMPLE = ["Name,Phone,Course", "Priya Sharma,9876543210,BBA", "Rahul Verma,+91 98123 45678,B.Tech CSE"].join(
  "\r\n"
);

export async function GET(): Promise<NextResponse> {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return new NextResponse("﻿" + SAMPLE + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="call-list-sample.csv"',
    },
  });
}
