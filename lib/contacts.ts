/**
 * lib/contacts.ts
 *
 * Reads and calls for the admin's call list (models/Contact.ts).
 */

import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { isOutboundCallingConfigured, startOutboundCall, type StartCallResult } from "@/lib/outboundCalls";
import ContactModel, { type ContactStatus } from "@/models/Contact";
import LeadModel from "@/models/Lead";

export const CONTACTS_PAGE_SIZE = 50;

export interface ContactListItem {
  id: string;
  name: string;
  phone: string;
  course: string;
  source: string;
  status: ContactStatus;
  callAttempts: number;
  lastCalledAt: string | null;
  lastError: string;
  /** The Lead this number became once a call reached the webhook, if any. */
  leadId: string | null;
}

interface ContactLean {
  _id: { toString(): string };
  name?: string;
  phone?: string;
  phoneKey?: string;
  course?: string;
  source?: string;
  status?: ContactStatus;
  callAttempts?: number;
  lastCalledAt?: Date | null;
  lastError?: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ContactsPageResult {
  contacts: ContactListItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export async function getContactsPage(
  search: string,
  status: ContactStatus | "",
  page: number,
  pageSize = CONTACTS_PAGE_SIZE
): Promise<ContactsPageResult> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (search) {
    const digits = search.replace(/\D/g, "");
    query.$or = [
      { name: new RegExp(escapeRegex(search), "i") },
      ...(digits.length >= 4 ? [{ phoneKey: new RegExp(digits) }] : []),
    ];
  }
  if (status) query.status = status;

  const totalCount = await ContactModel.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  // Not-yet-called first (in upload order), then those called longest ago.
  const docs = (await ContactModel.find(query)
    .sort({ lastCalledAt: 1, createdAt: 1, _id: 1 })
    .skip((currentPage - 1) * pageSize)
    .limit(pageSize)
    .lean()) as unknown as ContactLean[];

  const keys = docs.map((doc) => doc.phoneKey).filter((key): key is string => Boolean(key));
  const leads = (await LeadModel.find({ phoneKey: { $in: keys } })
    .select("phoneKey")
    .lean()) as unknown as { _id: { toString(): string }; phoneKey: string }[];
  const leadIdByKey = new Map(leads.map((lead) => [lead.phoneKey, lead._id.toString()]));

  return {
    contacts: docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name ?? "",
      phone: doc.phone ?? "",
      course: doc.course ?? "",
      source: doc.source ?? "",
      status: doc.status ?? "new",
      callAttempts: doc.callAttempts ?? 0,
      lastCalledAt: doc.lastCalledAt ? doc.lastCalledAt.toISOString() : null,
      lastError: doc.lastError ?? "",
      leadId: (doc.phoneKey && leadIdByKey.get(doc.phoneKey)) || null,
    })),
    totalCount,
    totalPages,
    currentPage,
  };
}

export async function countContactsByStatus(): Promise<Record<ContactStatus | "total", number>> {
  await connectToDatabase();
  const rows = (await ContactModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])) as {
    _id: ContactStatus;
    count: number;
  }[];
  const counts = { total: 0, new: 0, called: 0, failed: 0 };
  for (const { _id, count } of rows) {
    if (_id in counts) counts[_id] = count;
    counts.total += count;
  }
  return counts;
}

/** Places a call to one contact and records the outcome on it. */
export async function callContact(contactId: string): Promise<StartCallResult> {
  if (!isValidObjectId(contactId)) return { ok: false, error: "Contact not found." };
  // Not a failure of this contact — don't mark it as one.
  if (!isOutboundCallingConfigured()) return { ok: false, error: "Calling isn't set up yet." };
  await connectToDatabase();

  const contact = (await ContactModel.findById(contactId).lean()) as unknown as ContactLean | null;
  if (!contact) return { ok: false, error: "Contact not found." };

  const result = await startOutboundCall(
    {
      id: contact._id.toString(),
      callerName: contact.name ?? "",
      callerNumber: contact.phone ?? "",
      interestedCourse: contact.course ?? "",
    },
    "call-list"
  );

  await ContactModel.updateOne(
    { _id: contact._id },
    {
      $set: {
        status: result.ok ? "called" : "failed",
        lastCalledAt: new Date(),
        lastError: result.ok ? "" : result.error,
      },
      $inc: { callAttempts: 1 },
    }
  );

  return result;
}
