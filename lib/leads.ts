/**
 * lib/leads.ts
 *
 * Shared read helpers for the admin dashboard. A "lead" is a Lead document
 * (one per caller, see models/Lead.ts); each of its calls is a CallRecord
 * written by the Vapi webhook. Analytics still count calls.
 */

import { connectToDatabase } from "@/lib/mongodb";
import CallRecordModel from "@/models/CallRecord";
import LeadModel from "@/models/Lead";
import { APP_TIME_ZONE, appDayKey, startOfAppDay } from "@/lib/time";
import {
  LEAD_TEMPERATURES,
  isLeadStatus,
  type LeadStatus,
  type LeadTemperature,
} from "@/lib/leadPipeline";

export const LEADS_PAGE_SIZE = 20;

export interface LeadNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface LeadListItem {
  id: string;
  callerName: string;
  callerNumber: string;
  interestedCourse: string;
  academicMarks: string;
  hostelRequired: string;
  location: string;
  nextAction: string;
  callerRole: string;
  leadTemperature: string;
  preferredCallbackTime: string;
  summary: string;
  status: LeadStatus;
  followUpAt: string | null;
  callCount: number;
  firstCallAt: string;
  lastCallAt: string;
}

export interface LeadCall {
  id: string;
  timestamp: string;
  summary: string;
  transcript: string;
  nextAction: string;
  leadTemperature: string;
  endedReason: string;
  startedAt: string | null;
  endedAt: string | null;
  cost: number | null;
  direction: string;
}

export interface LeadDetail extends LeadListItem {
  notes: LeadNote[];
  calls: LeadCall[];
  doNotCall: boolean;
  callbackAttempts: number;
  lastCallbackAt: string | null;
  lastCallbackError: string;
}

// Loose shapes of lean documents.
interface LeadLean {
  _id: { toString(): string };
  callerName?: string;
  callerNumber?: string;
  interestedCourse?: string;
  academicMarks?: string;
  hostelRequired?: string;
  location?: string;
  nextAction?: string;
  callerRole?: string;
  leadTemperature?: string;
  preferredCallbackTime?: string;
  summary?: string;
  status?: string;
  followUpAt?: Date | null;
  callCount?: number;
  firstCallAt?: Date;
  lastCallAt?: Date;
  notes?: { _id: { toString(): string }; text: string; author?: string; createdAt?: Date }[];
  doNotCall?: boolean;
  callbackAttempts?: number;
  lastCallbackAt?: Date | null;
  lastCallbackError?: string;
}

interface CallRecordLean {
  _id: { toString(): string };
  leadId?: { toString(): string };
  timestamp?: Date | string;
  summary?: string;
  transcript?: string;
  nextAction?: string;
  leadTemperature?: string;
  endedReason?: string;
  startedAt?: Date | string;
  endedAt?: Date | string;
  cost?: number;
  direction?: string;
}

function toIsoString(value: Date | string | undefined | null): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

function serializeLead(doc: LeadLean): LeadListItem {
  return {
    id: doc._id.toString(),
    callerName: doc.callerName ?? "",
    callerNumber: doc.callerNumber ?? "",
    interestedCourse: doc.interestedCourse ?? "",
    academicMarks: doc.academicMarks ?? "",
    hostelRequired: doc.hostelRequired ?? "",
    location: doc.location ?? "",
    nextAction: doc.nextAction ?? "",
    callerRole: doc.callerRole ?? "",
    leadTemperature: doc.leadTemperature ?? "",
    preferredCallbackTime: doc.preferredCallbackTime ?? "",
    summary: doc.summary ?? "",
    status: isLeadStatus(doc.status) ? doc.status : "new",
    followUpAt: doc.followUpAt ? toIsoString(doc.followUpAt) : null,
    callCount: doc.callCount ?? 0,
    firstCallAt: toIsoString(doc.firstCallAt),
    lastCallAt: toIsoString(doc.lastCallAt),
  };
}

function serializeCall(doc: CallRecordLean): LeadCall {
  return {
    id: doc._id.toString(),
    timestamp: toIsoString(doc.timestamp),
    summary: doc.summary ?? "",
    transcript: doc.transcript ?? "",
    nextAction: doc.nextAction ?? "",
    leadTemperature: doc.leadTemperature ?? "",
    endedReason: doc.endedReason ?? "",
    startedAt: doc.startedAt ? toIsoString(doc.startedAt) : null,
    endedAt: doc.endedAt ? toIsoString(doc.endedAt) : null,
    cost: typeof doc.cost === "number" ? doc.cost : null,
    direction: doc.direction ?? "",
  };
}

// ---------------------------------------------------------------------------
// Filters (shared by the leads page and the CSV export)
// ---------------------------------------------------------------------------

export interface LeadFilters {
  q: string;
  status: LeadStatus | "";
  temperature: LeadTemperature | "";
  course: string;
  /** "due" = follow-up date is today or earlier. */
  followUp: "due" | "";
  /** IST calendar dates, YYYY-MM-DD, matched against the last call. */
  from: string;
  to: string;
}

type SearchParamValue = string | string[] | undefined;

function firstValue(value: SearchParamValue): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseLeadFilters(params: Record<string, SearchParamValue>): LeadFilters {
  const status = firstValue(params.status);
  const temperature = firstValue(params.temperature);
  const from = firstValue(params.from);
  const to = firstValue(params.to);

  return {
    q: firstValue(params.q).slice(0, 100),
    status: isLeadStatus(status) ? status : "",
    temperature: (LEAD_TEMPERATURES as readonly string[]).includes(temperature)
      ? (temperature as LeadTemperature)
      : "",
    course: firstValue(params.course).slice(0, 100),
    followUp: firstValue(params.followUp) === "due" ? "due" : "",
    from: DATE_PATTERN.test(from) ? from : "",
    to: DATE_PATTERN.test(to) ? to : "",
  };
}

/** Turns filters back into a query string (without "?"), skipping empty ones. */
export function leadFiltersToQuery(filters: LeadFilters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Start of an IST calendar day (YYYY-MM-DD) as a Date. IST has no DST. */
export function istDayStart(day: string): Date {
  return new Date(`${day}T00:00:00+05:30`);
}

function buildLeadQuery(filters: LeadFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), "i");
    const digits = filters.q.replace(/\D/g, "");
    query.$or = [
      { callerName: pattern },
      { callerNumber: pattern },
      // "98765 43210" or "+91-98765…" should still find the number.
      ...(digits.length >= 4 ? [{ phoneKey: new RegExp(digits) }] : []),
    ];
  }
  if (filters.status) query.status = filters.status;
  if (filters.temperature) query.leadTemperature = filters.temperature;
  if (filters.course) query.interestedCourse = new RegExp(escapeRegex(filters.course), "i");
  // Due = follow-up date before the start of tomorrow (IST), i.e. today or overdue.
  if (filters.followUp === "due") query.followUpAt = { $ne: null, $lt: startOfAppDay(-1) };

  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.$gte = istDayStart(filters.from);
    if (filters.to) range.$lt = new Date(istDayStart(filters.to).getTime() + 24 * 60 * 60 * 1000);
    query.lastCallAt = range;
  }

  return query;
}

// ---------------------------------------------------------------------------
// Lead reads
// ---------------------------------------------------------------------------

export interface LeadsPageResult {
  leads: LeadListItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export async function getLeadsPage(
  filters: LeadFilters,
  page: number,
  pageSize = LEADS_PAGE_SIZE
): Promise<LeadsPageResult> {
  await connectToDatabase();

  const query = buildLeadQuery(filters);
  const totalCount = await LeadModel.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  // Due follow-ups are worked oldest-first; everything else newest call first.
  const sort: Record<string, 1 | -1> =
    filters.followUp === "due" ? { followUpAt: 1, _id: 1 } : { lastCallAt: -1, _id: -1 };

  const docs = (await LeadModel.find(query)
    .select("-notes")
    .sort(sort)
    .skip((currentPage - 1) * pageSize)
    .limit(pageSize)
    .lean()) as unknown as LeadLean[];

  return { leads: docs.map(serializeLead), totalCount, totalPages, currentPage };
}

/** Every lead matching the filters (up to `limit`), newest call first — for the CSV export. */
export async function getAllLeads(filters: LeadFilters, limit = 10_000): Promise<LeadListItem[]> {
  await connectToDatabase();

  const docs = (await LeadModel.find(buildLeadQuery(filters))
    .select("-notes")
    .sort({ lastCallAt: -1, _id: -1 })
    .limit(limit)
    .lean()) as unknown as LeadLean[];

  return docs.map(serializeLead);
}

/** How many leads have a follow-up due today or overdue. */
export async function countDueFollowUps(): Promise<number> {
  await connectToDatabase();
  return LeadModel.countDocuments({ followUpAt: { $ne: null, $lt: startOfAppDay(-1) } });
}

export async function getLeadById(id: string): Promise<LeadDetail | null> {
  await connectToDatabase();

  try {
    const doc = (await LeadModel.findById(id).lean()) as unknown as LeadLean | null;
    if (!doc) return null;

    const calls = (await CallRecordModel.find({ leadId: doc._id })
      .select("-rawAnalysis")
      .sort({ timestamp: -1 })
      .lean()) as unknown as CallRecordLean[];

    return {
      ...serializeLead(doc),
      // Newest note first.
      notes: (doc.notes ?? [])
        .map((note) => ({
          id: note._id.toString(),
          text: note.text,
          author: note.author ?? "",
          createdAt: toIsoString(note.createdAt),
        }))
        .reverse(),
      calls: calls.map(serializeCall),
      doNotCall: doc.doNotCall === true,
      callbackAttempts: doc.callbackAttempts ?? 0,
      lastCallbackAt: doc.lastCallbackAt ? toIsoString(doc.lastCallbackAt) : null,
      lastCallbackError: doc.lastCallbackError ?? "",
    };
  } catch {
    // Invalid ObjectId format, etc.
    return null;
  }
}

/**
 * Links made before leads were grouped per caller point at a CallRecord id.
 * Returns the id of the Lead that call now belongs to, if any.
 */
export async function findLeadIdForCall(callRecordId: string): Promise<string | null> {
  await connectToDatabase();

  try {
    const call = (await CallRecordModel.findById(callRecordId)
      .select("leadId")
      .lean()) as unknown as CallRecordLean | null;
    return call?.leadId?.toString() ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Analytics (counts calls, i.e. CallRecords)
// ---------------------------------------------------------------------------

interface Bucket {
  label: string;
  count: number;
}

/** Groups all calls by `field`, folding blank/missing values into "Unknown". */
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
  recentLeads: LeadListItem[];
}

export async function getLeadsAnalytics(): Promise<LeadsAnalytics> {
  await connectToDatabase();

  const startOfToday = startOfAppDay(0);
  const sevenDaysAgo = startOfAppDay(6);

  const [totalLeads, leadsToday, topCourses, hostelBreakdown, allLocations, trendDocs, recentDocs] =
    await Promise.all([
      CallRecordModel.countDocuments(),
      CallRecordModel.countDocuments({ timestamp: { $gte: startOfToday } }),
      groupByField("interestedCourse", 6),
      groupByField("hostelRequired"),
      groupByField("location"),
      CallRecordModel.find({ timestamp: { $gte: sevenDaysAgo } })
        .select("timestamp")
        .lean() as unknown as Promise<{ timestamp: Date }[]>,
      LeadModel.find().select("-notes").sort({ lastCallAt: -1 }).limit(5).lean() as unknown as Promise<
        LeadLean[]
      >,
    ]);

  const hostelYesCount = hostelBreakdown.find((entry) => entry.label === "Yes")?.count ?? 0;
  const distinctLocationCount = allLocations.filter((entry) => entry.label !== "Unknown").length;
  const topLocations = allLocations.slice(0, 6);

  // Bucket the last 7 days by IST date so days with zero leads still show up.
  const countsByDay = new Map<string, number>();
  for (const doc of trendDocs) {
    const key = appDayKey(new Date(doc.timestamp));
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const dailyTrend: Bucket[] = [];
  for (let i = 6; i >= 0; i--) {
    // Midday of that IST day, so the key and weekday label can't straddle midnight.
    const date = new Date(startOfAppDay(i).getTime() + 12 * 60 * 60 * 1000);
    dailyTrend.push({
      label: date.toLocaleDateString("en-IN", { weekday: "short", timeZone: APP_TIME_ZONE }),
      count: countsByDay.get(appDayKey(date)) ?? 0,
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
