/**
 * lib/callbacks.ts
 *
 * When and whom to call back. Used by the dashboard's "Call now" button
 * (manual) and by /api/cron/callbacks (scheduled), which rings leads whose
 * follow-up date has arrived.
 *
 * Scheduled callbacks are opt-in (AUTO_CALLBACKS_ENABLED=true) and only:
 *   - inside calling hours (CALLBACK_HOURS in IST, default 10-19, Mon–Sat),
 *   - for leads not marked Enrolled/Lost or "do not call",
 *   - at most once per day per lead, and at most MAX_CALLBACK_ATTEMPTS
 *     times for the same follow-up date (unanswered calls retry next day).
 */

import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { startOutboundCall, type CallbackTrigger, type StartCallResult } from "@/lib/outboundCalls";
import { APP_TIME_ZONE, startOfAppDay } from "@/lib/time";
import LeadModel from "@/models/Lead";

export const MAX_CALLBACK_ATTEMPTS = 3;

interface LeadForCallback {
  _id: Types.ObjectId;
  callerName?: string;
  callerNumber?: string;
  interestedCourse?: string;
}

export function isAutoCallbackEnabled(): boolean {
  return process.env.AUTO_CALLBACKS_ENABLED?.trim().toLowerCase() === "true";
}

/** Parses CALLBACK_HOURS ("10-19" = 10:00 to 18:59 IST). */
function callingHours(): { start: number; end: number } {
  const match = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(process.env.CALLBACK_HOURS?.trim() ?? "");
  const start = match ? Number(match[1]) : 10;
  const end = match ? Number(match[2]) : 19;
  return start < end && end <= 24 ? { start, end } : { start: 10, end: 19 };
}

/** Monday–Saturday, inside CALLBACK_HOURS, in IST. */
export function isWithinCallingHours(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const { start, end } = callingHours();
  return weekday !== "Sun" && hour >= start && hour < end;
}

function toCallbackLead(doc: LeadForCallback) {
  return {
    id: doc._id.toString(),
    callerName: doc.callerName ?? "",
    callerNumber: doc.callerNumber ?? "",
    interestedCourse: doc.interestedCourse ?? "",
  };
}

async function recordResult(leadId: Types.ObjectId | string, result: StartCallResult): Promise<void> {
  await LeadModel.updateOne(
    { _id: leadId },
    { $set: { lastCallbackError: result.ok ? "" : result.error } }
  );
}

/** "Call now" from the dashboard. Doesn't count towards scheduled attempts. */
export async function callLeadNow(leadId: string): Promise<StartCallResult> {
  await connectToDatabase();

  const lead = (await LeadModel.findById(leadId)
    .select("callerName callerNumber interestedCourse doNotCall")
    .lean()) as (LeadForCallback & { doNotCall?: boolean }) | null;

  if (!lead) return { ok: false, error: "Lead not found." };
  if (lead.doNotCall) return { ok: false, error: "This lead is marked \"Do not call\"." };

  await LeadModel.updateOne({ _id: lead._id }, { $set: { lastCallbackAt: new Date() } });
  const result = await startOutboundCall(toCallbackLead(lead), "manual");
  await recordResult(lead._id, result);
  return result;
}

/** Leads whose follow-up is due today or overdue and who may be called today. */
function dueCallbackQuery(now: Date): Record<string, unknown> {
  return {
    followUpAt: { $ne: null, $lt: startOfAppDay(-1, now) },
    doNotCall: { $ne: true },
    status: { $nin: ["enrolled", "lost"] },
    callbackAttempts: { $not: { $gte: MAX_CALLBACK_ATTEMPTS } },
    phoneKey: { $type: "string" },
    $or: [{ lastCallbackAt: null }, { lastCallbackAt: { $lt: startOfAppDay(0, now) } }],
  };
}

export interface ScheduledRunResult {
  started: { leadId: string; callId: string }[];
  failed: { leadId: string; error: string }[];
}

/**
 * Calls up to `limit` due leads, oldest follow-up first. Each lead is
 * claimed with an atomic update before dialling, so overlapping runs
 * can't ring the same person twice.
 */
export async function runScheduledCallbacks(limit: number, now = new Date()): Promise<ScheduledRunResult> {
  await connectToDatabase();
  const result: ScheduledRunResult = { started: [], failed: [] };

  for (let i = 0; i < limit; i++) {
    const lead = (await LeadModel.findOneAndUpdate(
      dueCallbackQuery(now),
      { $set: { lastCallbackAt: now }, $inc: { callbackAttempts: 1 } },
      { sort: { followUpAt: 1, _id: 1 }, returnDocument: "after" }
    )
      .select("callerName callerNumber interestedCourse")
      .lean()) as LeadForCallback | null;

    if (!lead) break;

    const outcome = await startOutboundCall(toCallbackLead(lead), "scheduled" satisfies CallbackTrigger);
    await recordResult(lead._id, outcome);

    if (outcome.ok) result.started.push({ leadId: lead._id.toString(), callId: outcome.callId });
    else result.failed.push({ leadId: lead._id.toString(), error: outcome.error });
  }

  return result;
}
