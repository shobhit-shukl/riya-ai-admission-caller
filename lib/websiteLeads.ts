/**
 * lib/websiteLeads.ts
 *
 * Intake, listing and calling for enquiries from the university website
 * (models/WebsiteLead.ts). Submissions arrive server-to-server from the
 * website's backend at POST /api/website-leads.
 */

import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { phoneKey } from "@/lib/leadPipeline";
import { isOutboundCallingConfigured, startOutboundCall, toE164, type StartCallResult } from "@/lib/outboundCalls";
import { startOfAppDay } from "@/lib/time";
import LeadModel from "@/models/Lead";
import WebsiteLeadModel from "@/models/WebsiteLead";
import { WEBSITE_FORM_TYPES, type WebsiteFormType, type WebsiteLeadStatus } from "@/lib/websiteLeadTypes";

export const WEBSITE_LEADS_PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export interface WebsiteLeadInput {
  externalId?: string;
  name: string;
  phone: string;
  email: string;
  course: string;
  city: string;
  message: string;
  formType: WebsiteFormType;
  sourcePage: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  submittedAt: Date;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates an incoming submission. Returns field errors rather than throwing. */
export function parseWebsiteLead(body: unknown): { ok: true; lead: WebsiteLeadInput } | { ok: false; errors: string[] } {
  if (typeof body !== "object" || body === null) return { ok: false, errors: ["Body must be a JSON object."] };
  const raw = body as Record<string, unknown>;
  const errors: string[] = [];

  const name = text(raw.name, 100);
  const phone = text(raw.phone, 30);
  const email = text(raw.email, 200).toLowerCase();
  const message = typeof raw.message === "string" ? raw.message.trim().slice(0, 2000) : "";
  const formType = (WEBSITE_FORM_TYPES as readonly string[]).includes(String(raw.formType))
    ? (raw.formType as WebsiteFormType)
    : "enquiry";
  const submittedAt = typeof raw.submittedAt === "string" ? new Date(raw.submittedAt) : new Date();

  if (!name) errors.push("name is required.");
  if (!phone) errors.push("phone is required.");
  else if (!phoneKey(phone) || !toE164(phone)) errors.push("phone isn't a valid phone number.");
  if (email && !EMAIL_PATTERN.test(email)) errors.push("email isn't valid.");

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    lead: {
      externalId: text(raw.externalId, 100) || undefined,
      name,
      phone,
      email,
      course: text(raw.course, 100),
      city: text(raw.city, 100),
      message,
      formType,
      sourcePage: text(raw.sourcePage, 300),
      utmSource: text(raw.utmSource, 100),
      utmMedium: text(raw.utmMedium, 100),
      utmCampaign: text(raw.utmCampaign, 100),
      // Ignore clock-skewed or garbage timestamps from the sender.
      submittedAt:
        Number.isNaN(submittedAt.getTime()) || submittedAt.getTime() > Date.now() + 5 * 60_000
          ? new Date()
          : submittedAt,
    },
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

/** Stores a submission. A repeat of the same externalId returns the existing record. */
export async function saveWebsiteLead(lead: WebsiteLeadInput): Promise<{ id: string; duplicate: boolean }> {
  await connectToDatabase();

  if (lead.externalId) {
    const existing = (await WebsiteLeadModel.findOne({ externalId: lead.externalId }).select("_id").lean()) as {
      _id: { toString(): string };
    } | null;
    if (existing) return { id: existing._id.toString(), duplicate: true };
  }

  try {
    const doc = await WebsiteLeadModel.create({ ...lead, phoneKey: phoneKey(lead.phone) });
    return { id: doc._id.toString(), duplicate: false };
  } catch (error: unknown) {
    // Two deliveries of the same submission racing each other.
    if (lead.externalId && isDuplicateKeyError(error)) {
      const existing = (await WebsiteLeadModel.findOne({ externalId: lead.externalId }).select("_id").lean()) as {
        _id: { toString(): string };
      };
      return { id: existing._id.toString(), duplicate: true };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export interface WebsiteLeadListItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  course: string;
  city: string;
  message: string;
  formType: WebsiteFormType;
  sourcePage: string;
  utmSource: string;
  utmCampaign: string;
  submittedAt: string;
  status: WebsiteLeadStatus;
  callAttempts: number;
  lastCalledAt: string | null;
  lastCallError: string;
  /** The call Lead for the same phone number, once Sam has spoken to them. */
  leadId: string | null;
  /** How many times this number has enquired on the website. */
  enquiryCount: number;
}

interface WebsiteLeadLean {
  _id: { toString(): string };
  name?: string;
  phone?: string;
  phoneKey?: string;
  email?: string;
  course?: string;
  city?: string;
  message?: string;
  formType?: WebsiteFormType;
  sourcePage?: string;
  utmSource?: string;
  utmCampaign?: string;
  submittedAt?: Date;
  status?: WebsiteLeadStatus;
  callAttempts?: number;
  lastCalledAt?: Date | null;
  lastCallError?: string;
}

export interface WebsiteLeadFilters {
  q: string;
  status: WebsiteLeadStatus | "";
  formType: WebsiteFormType | "";
  course: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildQuery(filters: WebsiteLeadFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), "i");
    const digits = filters.q.replace(/\D/g, "");
    query.$or = [
      { name: pattern },
      { email: pattern },
      ...(digits.length >= 4 ? [{ phoneKey: new RegExp(digits) }] : []),
    ];
  }
  if (filters.status) query.status = filters.status;
  if (filters.formType) query.formType = filters.formType;
  if (filters.course) query.course = new RegExp(escapeRegex(filters.course), "i");
  return query;
}

export interface WebsiteLeadsPage {
  leads: WebsiteLeadListItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export async function getWebsiteLeadsPage(
  filters: WebsiteLeadFilters,
  page: number,
  pageSize = WEBSITE_LEADS_PAGE_SIZE
): Promise<WebsiteLeadsPage> {
  await connectToDatabase();

  const query = buildQuery(filters);
  const totalCount = await WebsiteLeadModel.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const docs = (await WebsiteLeadModel.find(query)
    .sort({ submittedAt: -1, _id: -1 })
    .skip((currentPage - 1) * pageSize)
    .limit(pageSize)
    .lean()) as unknown as WebsiteLeadLean[];

  const keys = [...new Set(docs.map((doc) => doc.phoneKey).filter((key): key is string => Boolean(key)))];
  const [leads, counts] = await Promise.all([
    LeadModel.find({ phoneKey: { $in: keys } }).select("phoneKey").lean() as unknown as Promise<
      { _id: { toString(): string }; phoneKey: string }[]
    >,
    WebsiteLeadModel.aggregate([
      { $match: { phoneKey: { $in: keys } } },
      { $group: { _id: "$phoneKey", count: { $sum: 1 } } },
    ]) as unknown as Promise<{ _id: string; count: number }[]>,
  ]);
  const leadIdByKey = new Map(leads.map((lead) => [lead.phoneKey, lead._id.toString()]));
  const countByKey = new Map(counts.map((row) => [row._id, row.count]));

  return {
    leads: docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name ?? "",
      phone: doc.phone ?? "",
      email: doc.email ?? "",
      course: doc.course ?? "",
      city: doc.city ?? "",
      message: doc.message ?? "",
      formType: doc.formType ?? "enquiry",
      sourcePage: doc.sourcePage ?? "",
      utmSource: doc.utmSource ?? "",
      utmCampaign: doc.utmCampaign ?? "",
      submittedAt: doc.submittedAt ? doc.submittedAt.toISOString() : "",
      status: doc.status ?? "new",
      callAttempts: doc.callAttempts ?? 0,
      lastCalledAt: doc.lastCalledAt ? doc.lastCalledAt.toISOString() : null,
      lastCallError: doc.lastCallError ?? "",
      leadId: (doc.phoneKey && leadIdByKey.get(doc.phoneKey)) || null,
      enquiryCount: (doc.phoneKey && countByKey.get(doc.phoneKey)) || 1,
    })),
    totalCount,
    totalPages,
    currentPage,
  };
}

export async function countWebsiteLeads(): Promise<{ total: number; new: number; today: number }> {
  await connectToDatabase();
  const startOfToday = startOfAppDay(0);
  const [total, fresh, today] = await Promise.all([
    WebsiteLeadModel.countDocuments(),
    WebsiteLeadModel.countDocuments({ status: "new" }),
    WebsiteLeadModel.countDocuments({ submittedAt: { $gte: startOfToday } }),
  ]);
  return { total, new: fresh, today };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function setWebsiteLeadStatus(id: string, status: WebsiteLeadStatus): Promise<void> {
  if (!isValidObjectId(id)) return;
  await connectToDatabase();
  await WebsiteLeadModel.updateOne({ _id: id }, { $set: { status } });
}

/** Has the assistant call the student who enquired, and records the outcome. */
export async function callWebsiteLead(id: string): Promise<StartCallResult> {
  if (!isValidObjectId(id)) return { ok: false, error: "Enquiry not found." };
  if (!isOutboundCallingConfigured()) return { ok: false, error: "Calling isn't set up yet." };
  await connectToDatabase();

  const lead = (await WebsiteLeadModel.findById(id).lean()) as unknown as WebsiteLeadLean | null;
  if (!lead) return { ok: false, error: "Enquiry not found." };

  const result = await startOutboundCall(
    { id, callerName: lead.name ?? "", callerNumber: lead.phone ?? "", interestedCourse: lead.course ?? "" },
    "website"
  );

  await WebsiteLeadModel.updateOne(
    { _id: id },
    {
      $set: {
        lastCalledAt: new Date(),
        lastCallError: result.ok ? "" : result.error,
        // A first successful call moves a fresh enquiry along the pipeline.
        ...(result.ok && lead.status === "new" ? { status: "contacted" } : {}),
      },
      $inc: { callAttempts: 1 },
    }
  );

  return result;
}
