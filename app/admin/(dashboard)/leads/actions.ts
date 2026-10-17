"use server";

/**
 * Server Actions for working a lead from the dashboard: move it through the
 * pipeline, set a follow-up date, add counselor notes, and have the
 * assistant call the lead back.
 *
 * Server Actions are reachable by direct POST, not just through the UI, so
 * each one checks the admin session itself.
 */

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/auth";
import { callLeadNow } from "@/lib/callbacks";
import { connectToDatabase } from "@/lib/mongodb";
import { isLeadStatus } from "@/lib/leadPipeline";
import { istDayStart } from "@/lib/leads";
import LeadModel from "@/models/Lead";

const MAX_NOTE_LENGTH = 2000;

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

function readLeadId(formData: FormData): string {
  const id = String(formData.get("leadId") ?? "");
  if (!isValidObjectId(id)) throw new Error("Invalid lead id");
  return id;
}

function revalidateLead(id: string) {
  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin/leads");
}

export async function updateLeadPipeline(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = readLeadId(formData);

  const status = formData.get("status");
  if (!isLeadStatus(status)) throw new Error("Invalid status");

  // <input type="date"> sends YYYY-MM-DD (or "" to clear the follow-up).
  const followUpDate = String(formData.get("followUpDate") ?? "");
  const followUpAt = /^\d{4}-\d{2}-\d{2}$/.test(followUpDate) ? istDayStart(followUpDate) : null;
  const doNotCall = formData.get("doNotCall") === "on";

  await connectToDatabase();
  const current = (await LeadModel.findById(id).select("followUpAt").lean()) as { followUpAt?: Date | null } | null;
  const followUpChanged = (current?.followUpAt?.getTime() ?? null) !== (followUpAt?.getTime() ?? null);

  await LeadModel.updateOne(
    { _id: id },
    {
      $set: {
        status,
        followUpAt,
        doNotCall,
        // A new follow-up date gets a fresh set of scheduled callback attempts.
        ...(followUpChanged ? { callbackAttempts: 0, lastCallbackError: "" } : {}),
      },
    }
  );
  revalidateLead(id);
}

export interface CallNowState {
  ok: boolean;
  message: string;
}

export async function callLeadNowAction(_previous: CallNowState | null, formData: FormData): Promise<CallNowState> {
  await requireAdmin();
  const id = readLeadId(formData);

  const result = await callLeadNow(id);
  revalidateLead(id);

  return result.ok
    ? { ok: true, message: "Calling now. The call will appear in this lead's history when it ends." }
    : { ok: false, message: result.error };
}

export async function addLeadNote(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const id = readLeadId(formData);

  const text = String(formData.get("text") ?? "").trim().slice(0, MAX_NOTE_LENGTH);
  if (!text) return;

  await connectToDatabase();
  await LeadModel.updateOne(
    { _id: id },
    { $push: { notes: { text, author: session.email, createdAt: new Date() } } }
  );
  revalidateLead(id);
}
