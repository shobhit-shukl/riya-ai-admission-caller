/**
 * GET /api/admin/leads/export
 *
 * Downloads the leads matching the same filters as /admin/leads (q, status,
 * temperature, course, followUp, from, to) as a CSV file. Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getAllLeads, parseLeadFilters, type LeadListItem } from "@/lib/leads";
import { LEAD_STATUS_LABELS } from "@/lib/leadPipeline";
import { appDayKey, formatInAppTimeZone } from "@/lib/time";

const COLUMNS: [string, (lead: LeadListItem) => string][] = [
  ["Name", (lead) => lead.callerName],
  ["Phone", (lead) => lead.callerNumber],
  ["Status", (lead) => LEAD_STATUS_LABELS[lead.status]],
  ["Temperature", (lead) => lead.leadTemperature],
  ["Course", (lead) => lead.interestedCourse],
  ["Academic Marks", (lead) => lead.academicMarks],
  ["Hostel", (lead) => lead.hostelRequired],
  ["Location", (lead) => lead.location],
  ["Caller Role", (lead) => lead.callerRole],
  ["Preferred Callback Time", (lead) => lead.preferredCallbackTime],
  ["Next Action", (lead) => lead.nextAction],
  ["Follow-up Date", (lead) => (lead.followUpAt ? appDayKey(new Date(lead.followUpAt)) : "")],
  ["Calls", (lead) => String(lead.callCount)],
  ["First Call (IST)", (lead) => formatInAppTimeZone(lead.firstCallAt, { dateStyle: "medium", timeStyle: "short" })],
  ["Last Call (IST)", (lead) => formatInAppTimeZone(lead.lastCallAt, { dateStyle: "medium", timeStyle: "short" })],
  ["Latest Summary", (lead) => lead.summary],
];

/**
 * Quotes a CSV cell. Values starting with = + - @ (or tab/CR) are prefixed
 * with ' so Excel/Sheets don't run caller-supplied text as a formula —
 * except plain numbers like "+91 98765 43210", which can't carry a formula.
 */
function csvCell(value: string): string {
  const isPlainNumber = /^[+-]?[\d\s()-]+$/.test(value);
  const safe = !isPlainNumber && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const filters = parseLeadFilters(Object.fromEntries(req.nextUrl.searchParams));
  const leads = await getAllLeads(filters);

  const lines = [
    COLUMNS.map(([header]) => csvCell(header)).join(","),
    ...leads.map((lead) => COLUMNS.map(([, read]) => csvCell(read(lead) || "")).join(",")),
  ];

  // BOM so Excel opens the UTF-8 file (Hindi names, ₹) correctly.
  const body = "﻿" + lines.join("\r\n");
  const filename = `leads-${appDayKey(new Date())}.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
