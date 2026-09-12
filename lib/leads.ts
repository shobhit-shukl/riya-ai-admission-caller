/**
 * lib/leads.ts
 *
 * Shared read helpers for the admin dashboard. "Leads" are the same
 * documents the Vapi webhook writes via CallRecordModel — one per
 * finished call.
 */

import { connectToDatabase } from "@/lib/mongodb";
import CallRecordModel from "@/models/CallRecord";

export const LEADS_PAGE_SIZE = 10;

export interface LeadListItem {
  id: string;
  timestamp: string;
  callerName: string;
  callerNumber: string;
  interestedCourse: string;
  summary: string;
  academicMarks: string;
  hostelRequired: string;
  location: string;
  nextAction: string;
}

export interface LeadDetail extends LeadListItem {
  transcript: string;
  endedReason: string;
  startedAt: string | null;
  endedAt: string | null;
  cost: number | null;
}

// Loose shape covering both a lean CallRecord document and its Mongoose fields.
interface CallRecordLean {
  _id: { toString(): string };
  timestamp?: Date | string;
  callerName?: string;
  callerNumber?: string;
  interestedCourse?: string;
  summary?: string;
  transcript?: string;
  academicMarks?: string;
  hostelRequired?: string;
  location?: string;
  nextAction?: string;
  endedReason?: string;
  startedAt?: Date | string;
  endedAt?: Date | string;
  cost?: number;
}

function toIsoString(value: Date | string | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

function serializeLead(doc: CallRecordLean): LeadDetail {
  return {
    id: doc._id.toString(),
    timestamp: toIsoString(doc.timestamp),
    callerName: doc.callerName ?? "",
    callerNumber: doc.callerNumber ?? "",
    interestedCourse: doc.interestedCourse ?? "",
    summary: doc.summary ?? "",
    transcript: doc.transcript ?? "",
    academicMarks: doc.academicMarks ?? "",
    hostelRequired: doc.hostelRequired ?? "",
    location: doc.location ?? "",
    nextAction: doc.nextAction ?? "",
    endedReason: doc.endedReason ?? "",
    startedAt: doc.startedAt ? toIsoString(doc.startedAt) : null,
    endedAt: doc.endedAt ? toIsoString(doc.endedAt) : null,
    cost: typeof doc.cost === "number" ? doc.cost : null,
  };
}

export interface LeadsPageResult {
  leads: LeadDetail[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export async function getLeadsPage(page: number, pageSize = LEADS_PAGE_SIZE): Promise<LeadsPageResult> {
  await connectToDatabase();

  const totalCount = await CallRecordModel.countDocuments();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const docs = (await CallRecordModel.find()
    .sort({ timestamp: -1 })
    .skip((currentPage - 1) * pageSize)
    .limit(pageSize)
    .lean()) as unknown as CallRecordLean[];

  return {
    leads: docs.map(serializeLead),
    totalCount,
    totalPages,
    currentPage,
  };
}

export async function getLeadById(id: string): Promise<LeadDetail | null> {
  await connectToDatabase();

  try {
    const doc = (await CallRecordModel.findById(id).lean()) as unknown as CallRecordLean | null;
    return doc ? serializeLead(doc) : null;
  } catch {
    // Invalid ObjectId format, etc.
    return null;
  }
}

interface Bucket {
  label: string;
  count: number;
}

/** Groups all documents by `field`, folding blank/missing values into "Unknown". */
async function groupByField(field: string, limit?: number): Promise<Bucket[]> {
  const results = (await CallRecordModel.aggregate([
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ])) as { _id: string | null; count: number }[];

  const buckets = new Map<string, number>();
  for (const { _id, count } of results) {
    const label = _id && _id.trim() !== "" ? _id.trim() : "Unknown";
    buckets.set(label, (buckets.get(label) ?? 0) + count);
  }

  const sorted = [...buckets.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

export interface LeadsAnalytics {
  totalLeads: number;
  leadsToday: number;
  hostelYesCount: number;
  distinctLocationCount: number;
  topCourses: Bucket[];
  hostelBreakdown: Bucket[];
  topLocations: Bucket[];
  dailyTrend: Bucket[];
  recentLeads: LeadDetail[];
}

export async function getLeadsAnalytics(): Promise<LeadsAnalytics> {
  await connectToDatabase();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [totalLeads, leadsToday, topCourses, hostelBreakdown, topLocations, trendDocs, recentDocs] =
    await Promise.all([
      CallRecordModel.countDocuments(),
      CallRecordModel.countDocuments({ timestamp: { $gte: startOfToday } }),
      groupByField("interestedCourse", 6),
      groupByField("hostelRequired"),
      groupByField("location", 6),
      CallRecordModel.find({ timestamp: { $gte: sevenDaysAgo } })
        .select("timestamp")
        .lean() as unknown as Promise<{ timestamp: Date }[]>,
      CallRecordModel.find().sort({ timestamp: -1 }).limit(5).lean() as unknown as Promise<CallRecordLean[]>,
    ]);

  const hostelYesCount = hostelBreakdown.find((entry) => entry.label === "Yes")?.count ?? 0;
  const distinctLocationCount = topLocations.filter((entry) => entry.label !== "Unknown").length;

  // Bucket the last 7 days by local date so days with zero leads still show up.
  const countsByDay = new Map<string, number>();
  for (const doc of trendDocs) {
    const key = new Date(doc.timestamp).toISOString().slice(0, 10);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const dailyTrend: Bucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    dailyTrend.push({
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      count: countsByDay.get(key) ?? 0,
    });
  }

  return {
    totalLeads,
    leadsToday,
    hostelYesCount,
    distinctLocationCount,
    topCourses,
    hostelBreakdown,
    topLocations,
    dailyTrend,
    recentLeads: recentDocs.map(serializeLead),
  };
}
