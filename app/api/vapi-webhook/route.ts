/**
 * app/api/vapi-webhook/route.ts
 *
 * POST endpoint that receives Vapi webhook events.
 * When a call ends (message.type === "end-of-call-report"), it:
 *   1. Verifies the request really came from Vapi (shared secret).
 *   2. Acknowledges immediately, then — after the response is sent —
 *      reads whatever Vapi already extracted: the assistant's Structured
 *      Outputs (message.artifact.structuredOutputs) first, then the legacy
 *      call analysis (message.call.analysis.summary / .structuredData).
 *   3. If no Structured Outputs arrived, fills in anything still missing
 *      with a Gemini pass over the transcript (course interest, marks,
 *      hostel, location, next action).
 *      Caller role, lead temperature and callback time only come from
 *      Structured Outputs.
 *   4. Writes the resulting record to MongoDB, then Google Sheets —
 *      skipping both if this call was already recorded (Vapi retries).
 *   5. Merges the call into the caller's Lead (one per phone number) and
 *      emails the admissions team if it's a Hot lead.
 *
 * An outbound call nobody answered (no answer, busy, voicemail) skips
 * steps 3–5: it is kept in the call history and its outcome is shown on
 * the lead / call-list contact / website lead it was made for, but it
 * creates no lead and adds no empty row to the sheet.
 *
 * Vapi webhook docs: https://docs.vapi.ai/server-url/events
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { isValidObjectId } from "mongoose";
import { after, NextRequest, NextResponse } from "next/server";
import { appendCallRecord, type CallRecord } from "@/lib/googleSheets";
import { extractCallData } from "@/lib/extractCallData";
import { connectToDatabase } from "@/lib/mongodb";
import { normalizeLeadTemperature, phoneKey } from "@/lib/leadPipeline";
import { upsertLeadFromCall } from "@/lib/leadStore";
import { sendHotLeadAlert } from "@/lib/notify";
import CallRecordModel from "@/models/CallRecord";
import ContactModel from "@/models/Contact";
import LeadModel from "@/models/Lead";
import WebsiteLeadModel from "@/models/WebsiteLead";

// Processing runs in `after()` once Vapi has its 200, but it still has to
// finish within the route's max duration (Gemini + MongoDB + Sheets).
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Vapi payload shape (partial – only the fields we need)
// ---------------------------------------------------------------------------

interface VapiCustomer {
  number?: string;
  name?: string;
}

interface VapiAnalysis {
  summary?: string;
  structuredData?: Record<string, unknown>;
  successEvaluation?: string;
}

interface VapiCall {
  id?: string;
  /** "inboundPhoneCall" | "outboundPhoneCall" | "webCall" | … */
  type?: string;
  customer?: VapiCustomer;
  analysis?: VapiAnalysis;
  startedAt?: string;
  endedAt?: string;
  cost?: number;
  /** On calls this app places: { leadId | contactId | websiteLeadId, trigger } (lib/outboundCalls.ts). */
  assistantOverrides?: { metadata?: Record<string, unknown> };
}

interface VapiStructuredOutput {
  name?: string;
  result?: unknown;
}

interface VapiArtifact {
  transcript?: string;
  /** Structured Outputs configured on the assistant, keyed by structured-output ID. */
  structuredOutputs?: Record<string, VapiStructuredOutput>;
}

interface VapiMessage {
  type: string;
  endedReason?: string;
  call?: VapiCall;
  artifact?: VapiArtifact;
  // Older/alternate payload shapes surface these at the top level too.
  transcript?: string;
  summary?: string;
  analysis?: VapiAnalysis;
}

interface VapiWebhookPayload {
  message: VapiMessage;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reads the first non-empty value found under any of `keys` on Vapi's own structuredData. */
function readStructuredField(
  structuredData: Record<string, unknown> | undefined,
  keys: string[]
): string {
  if (!structuredData) return "";

  for (const key of keys) {
    const value = structuredData[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }

  return "";
}

/** Turns one structured-output result into sheet-friendly text ("" when there's nothing to keep). */
function stringifyStructuredResult(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (Array.isArray(value)) return value.map(stringifyStructuredResult).filter(Boolean).join(", ");
  return JSON.stringify(value);
}

/** Flattens Vapi's Structured Outputs (keyed by ID) into a name → text map, skipping empty results. */
function readStructuredOutputs(
  outputs: Record<string, VapiStructuredOutput> | undefined
): Record<string, string> {
  const byName: Record<string, string> = {};
  if (!outputs) return byName;

  for (const output of Object.values(outputs)) {
    if (!output?.name) continue;
    const value = stringifyStructuredResult(output.result);
    if (value) byName[output.name] = value;
  }

  return byName;
}

function safeEqual(a: string, b: string): boolean {
  // Hash first so the comparison is constant-time regardless of length.
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * Checks the shared secret configured on the Vapi assistant's Server URL.
 * Vapi sends it as `x-vapi-secret` (server secret) or as a Bearer token
 * (Bearer-token server credential). Both are checked — Vapi can send an
 * org-level `x-vapi-secret` alongside the assistant's Bearer credential —
 * and the request is accepted if either matches. Surrounding whitespace is
 * ignored, since a pasted secret often picks up a trailing newline.
 *
 * Without VAPI_WEBHOOK_SECRET, anyone who finds the URL could POST fake
 * leads — so in production a missing secret rejects every request rather
 * than silently accepting them.
 */
function isAuthorizedVapiRequest(req: NextRequest): { ok: true } | { ok: false; status: number } {
  const expected = process.env.VAPI_WEBHOOK_SECRET?.trim();

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      console.error("[vapi-webhook] VAPI_WEBHOOK_SECRET is not set — rejecting request.");
      return { ok: false, status: 500 };
    }
    return { ok: true }; // Local development without a secret.
  }

  const headerSecret = req.headers.get("x-vapi-secret")?.trim();
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if ([headerSecret, bearer].some((provided) => provided && safeEqual(provided, expected))) {
    return { ok: true };
  }

  // Names and lengths only — never the values — so a mismatch can be diagnosed from the logs.
  console.warn(
    `[vapi-webhook] Rejected: secret mismatch (expected length ${expected.length}; ` +
      `x-vapi-secret ${headerSecret === undefined ? "absent" : `length ${headerSecret.length}`}; ` +
      `bearer ${bearer === undefined ? "absent" : `length ${bearer.length}`}).`
  );

  return { ok: false, status: 401 };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = isAuthorizedVapiRequest(req);
  if (!auth.ok) {
    const error = auth.status === 401 ? "Unauthorized." : "Webhook is not configured.";
    return NextResponse.json({ error }, { status: auth.status });
  }

  let body: VapiWebhookPayload;

  try {
    body = (await req.json()) as VapiWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { message } = body;

  // Only process end-of-call-report events – silently ack everything else.
  if (!message || message.type !== "end-of-call-report") {
    return NextResponse.json(
      { received: true, processed: false, reason: "Not an end-of-call-report event." },
      { status: 200 }
    );
  }

  // Gemini extraction plus two storage writes can take longer than Vapi
  // waits for a webhook response, which would make Vapi retry. Acknowledge
  // now and do the work after the response has been sent.
  after(async () => {
    try {
      await processEndOfCallReport(message);
    } catch (error: unknown) {
      console.error("[vapi-webhook] Failed to process end-of-call report:", error);
    }
  });

  return NextResponse.json({ received: true, queued: true }, { status: 200 });
}

async function processEndOfCallReport(message: VapiMessage): Promise<void> {
  const call = message.call;
  const analysis = call?.analysis ?? message.analysis;
  const structuredData = analysis?.structuredData;
  const outputs = readStructuredOutputs(message.artifact?.structuredOutputs);

  if (call?.id && (await isAlreadyRecorded(call.id))) {
    console.warn(`[vapi-webhook] Call ${call.id} already recorded — skipping duplicate delivery.`);
    return;
  }

  // 1. Pull what Vapi already knows: Structured Outputs first, then the
  //    legacy analysis.structuredData keys.
  // customer.number is the real caller ID on phone calls; the number the
  // caller said out loud is only a fallback (e.g. web calls have none).
  const customerNumber = call?.customer?.number;
  const callerNumber: string =
    (customerNumber && customerNumber !== "Unknown" ? customerNumber : outputs.callerPhone) || "Unknown";
  const transcript: string =
    message.artifact?.transcript ?? message.transcript ?? "No transcript available.";

  const direction = callDirection(call?.type);
  const unanswered =
    direction === "outbound"
      ? unansweredReason(message.endedReason, message.artifact?.transcript ?? message.transcript ?? "")
      : null;
  if (unanswered) {
    await recordUnansweredCall(message, callerNumber, unanswered);
    return;
  }

  let callerName: string =
    outputs.callerName || readStructuredField(structuredData, ["callerName"]) || call?.customer?.name || "";
  let summary: string = outputs.callSummary || analysis?.summary || message.summary || "";
  let interestedCourse =
    outputs.interestedCourse ||
    readStructuredField(structuredData, ["interestedCourse", "courseInterest", "course"]);
  let academicMarks = outputs.academicMarks || readStructuredField(structuredData, ["academicMarks", "marks"]);
  let hostelRequired = outputs.hostelRequired || readStructuredField(structuredData, ["hostelRequired", "hostel"]);
  let location = outputs.location || readStructuredField(structuredData, ["location", "city"]);
  let nextAction = outputs.nextAction || readStructuredField(structuredData, ["nextAction", "followUp"]);
  const callerRole = outputs.callerRole ?? "";
  const leadTemperature = outputs.leadTemperature ?? "";
  const preferredCallbackTime = outputs.preferredCallbackTime ?? "";

  // 2. Fill in anything Vapi didn't already give us with an LLM pass
  //    over the transcript. When Structured Outputs arrived, Vapi has
  //    already read the whole transcript — an empty field there means the
  //    caller never said it, so a second (paid) Gemini pass is skipped.
  const hasStructuredOutputs = Object.keys(outputs).length > 0;
  const hasEverything =
    callerName && summary && interestedCourse && academicMarks && hostelRequired && location && nextAction;

  if (!hasStructuredOutputs && !hasEverything) {
    const extracted = await extractCallData(transcript, summary);
    callerName ||= extracted.callerName;
    summary ||= extracted.summary;
    interestedCourse ||= extracted.interestedCourse;
    academicMarks ||= extracted.academicMarks;
    hostelRequired ||= extracted.hostelRequired;
    location ||= extracted.location;
    nextAction ||= extracted.nextAction;
  }

  summary ||= "No summary available.";

  const timestamp = new Date().toISOString();

  const record: CallRecord = {
    timestamp,
    callerName,
    callerNumber,
    interestedCourse,
    summary,
    transcript,
    academicMarks,
    hostelRequired,
    location,
    nextAction,
    callerRole,
    leadTemperature,
    preferredCallbackTime,
  };

  // 3. MongoDB first: its unique callId index tells us whether this call
  //    was already recorded by an earlier delivery of the same webhook.
  //    Any other MongoDB failure shouldn't stop the record reaching the
  //    sheet, so only a duplicate skips the sheet write.
  let callRecordId: string | undefined;
  try {
    callRecordId = await saveCallRecordToMongo(record, {
      callId: call?.id,
      endedReason: message.endedReason,
      startedAt: call?.startedAt,
      endedAt: call?.endedAt,
      cost: call?.cost,
      direction,
      rawAnalysis: analysis,
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      console.warn(`[vapi-webhook] Call ${call?.id} already recorded — skipping duplicate delivery.`);
      return;
    }
    console.error("[vapi-webhook] Failed to save to MongoDB:", error);
  }

  try {
    await appendCallRecord(record);
  } catch (error: unknown) {
    console.error("[vapi-webhook] Failed to append to Google Sheet:", error);
  }

  // 4. Fold the call into the caller's Lead (one per phone number) and,
  //    if it's a hot lead, alert the admissions team right away. Only for
  //    calls that were newly saved, so a retried webhook can't double-count.
  if (callRecordId) {
    try {
      await attachCallToLead(record, callRecordId, {
        startedAt: call?.startedAt,
        endedAt: call?.endedAt,
        endedReason: message.endedReason,
        direction,
      });
      // The student picked up: clear any earlier "no answer" on the contact / website lead.
      if (direction === "outbound") await recordOutcomeOnSource(call, "");
    } catch (error: unknown) {
      console.error("[vapi-webhook] Failed to update lead:", error);
    }
  }

  console.log(`[vapi-webhook] Processed call ${call?.id ?? "(no id)"} at ${timestamp}`);
}

// ---------------------------------------------------------------------------
// Outbound calls nobody answered
// ---------------------------------------------------------------------------

/**
 * For an outbound call that never reached the student, a short reason to
 * show the admin ("No answer", "Went to voicemail"…); null if they picked up.
 */
function unansweredReason(endedReason: string | undefined, transcript: string): string | null {
  const reason = endedReason ?? "";
  if (/voicemail/i.test(reason)) return "Went to voicemail";
  if (/customer-did-not-answer|no-answer/i.test(reason)) return "No answer";
  if (/customer-busy/i.test(reason)) return "Line busy";
  if (/failed-to-connect/i.test(reason)) return "Call didn't connect";
  // Other errors only count as unanswered if nobody said anything.
  if (/error/i.test(reason) && !transcript.trim()) return "Call didn't connect";
  return null;
}

/**
 * Keeps an unanswered outbound call in the history (on the student's Lead,
 * if they already have one) and notes the outcome where the call was
 * started from. No new lead, no extraction, no empty row in the sheet.
 */
async function recordUnansweredCall(message: VapiMessage, callerNumber: string, outcome: string): Promise<void> {
  const call = message.call;
  const note = `Last call: ${outcome}`;
  const record: CallRecord = {
    timestamp: new Date().toISOString(),
    callerName: call?.customer?.name ?? "",
    callerNumber,
    interestedCourse: "",
    summary: `${outcome} (outbound call).`,
    transcript: message.artifact?.transcript ?? message.transcript ?? "",
    academicMarks: "",
    hostelRequired: "",
    location: "",
    nextAction: "",
    callerRole: "",
    leadTemperature: "",
    preferredCallbackTime: "",
  };

  let callRecordId: string;
  try {
    callRecordId = await saveCallRecordToMongo(record, {
      callId: call?.id,
      endedReason: message.endedReason,
      startedAt: call?.startedAt,
      endedAt: call?.endedAt,
      cost: call?.cost,
      direction: "outbound",
    });
  } catch (error: unknown) {
    if (!isDuplicateKeyError(error)) console.error("[vapi-webhook] Failed to save unanswered call:", error);
    return;
  }

  try {
    const key = phoneKey(callerNumber);
    const lead = key
      ? await LeadModel.findOneAndUpdate({ phoneKey: key }, { $set: { lastCallbackError: note } }).select("_id").lean<{
          _id: unknown;
        }>()
      : null;
    if (lead) await CallRecordModel.updateOne({ _id: callRecordId }, { $set: { leadId: lead._id } });
    await recordOutcomeOnSource(call, note);
  } catch (error: unknown) {
    console.error("[vapi-webhook] Failed to record unanswered call outcome:", error);
  }

  console.log(`[vapi-webhook] Outbound call ${call?.id ?? "(no id)"} not answered: ${message.endedReason}`);
}

/** Shows how a call went on the call-list contact or website lead it was placed from (via call metadata). */
async function recordOutcomeOnSource(call: VapiCall | undefined, note: string): Promise<void> {
  const metadata = call?.assistantOverrides?.metadata ?? {};
  const contactId = String(metadata.contactId ?? "");
  const websiteLeadId = String(metadata.websiteLeadId ?? "");

  if (isValidObjectId(contactId)) {
    await ContactModel.updateOne({ _id: contactId }, { $set: { lastError: note } });
  }
  if (isValidObjectId(websiteLeadId)) {
    await WebsiteLeadModel.updateOne({ _id: websiteLeadId }, { $set: { lastCallError: note } });
  }
}

// ---------------------------------------------------------------------------
// MongoDB persistence
// ---------------------------------------------------------------------------

interface CallRecordMeta {
  callId?: string;
  endedReason?: string;
  startedAt?: string;
  endedAt?: string;
  cost?: number;
  direction?: CallDirection;
  rawAnalysis?: VapiAnalysis;
}

type CallDirection = "inbound" | "outbound" | "web" | "";

function callDirection(type: string | undefined): CallDirection {
  if (type === "inboundPhoneCall") return "inbound";
  if (type === "outboundPhoneCall") return "outbound";
  if (type === "webCall") return "web";
  return "";
}

/** Cheap early check so a retried webhook doesn't re-run Gemini. Never throws. */
async function isAlreadyRecorded(callId: string): Promise<boolean> {
  try {
    await connectToDatabase();
    return (await CallRecordModel.exists({ callId })) !== null;
  } catch {
    return false; // If MongoDB is down, still try to get the record into the sheet.
  }
}

/** Saves the call and returns its document id. */
async function saveCallRecordToMongo(record: CallRecord, meta: CallRecordMeta): Promise<string> {
  await connectToDatabase();

  const doc = await CallRecordModel.create({
    ...record,
    timestamp: new Date(record.timestamp),
    callId: meta.callId,
    endedReason: meta.endedReason,
    startedAt: meta.startedAt ? new Date(meta.startedAt) : undefined,
    endedAt: meta.endedAt ? new Date(meta.endedAt) : undefined,
    cost: meta.cost,
    direction: meta.direction,
    rawAnalysis: meta.rawAnalysis,
  });

  return doc._id.toString();
}

interface CallOutcome {
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  direction: CallDirection;
}

/**
 * Whether an outbound callback actually reached the student: not voicemail,
 * busy or unanswered, and long enough to be a conversation.
 */
function isConnectedCallback(outcome: CallOutcome): boolean {
  if (outcome.direction !== "outbound") return false;
  if (/voicemail|no-answer|busy|failed|error|did-not-answer/i.test(outcome.endedReason ?? "")) return false;
  if (!outcome.startedAt || !outcome.endedAt) return false;
  const seconds = (new Date(outcome.endedAt).getTime() - new Date(outcome.startedAt).getTime()) / 1000;
  return seconds >= 20;
}

async function attachCallToLead(record: CallRecord, callRecordId: string, outcome: CallOutcome): Promise<void> {
  const callTime = new Date(outcome.endedAt ?? record.timestamp);
  const leadId = await upsertLeadFromCall(record, callTime);
  await CallRecordModel.updateOne({ _id: callRecordId }, { $set: { leadId } });

  // A callback that reached the student settles the follow-up it was made
  // for, so the scheduler doesn't ring them again tomorrow.
  if (isConnectedCallback(outcome)) {
    await LeadModel.updateOne(
      { _id: leadId },
      { $set: { followUpAt: null, callbackAttempts: 0, lastCallbackError: "" } }
    );
  } else if (outcome.direction === "outbound") {
    // Picked up, if only briefly: an earlier "no answer" no longer applies.
    await LeadModel.updateOne({ _id: leadId }, { $set: { lastCallbackError: "" } });
  }

  if (normalizeLeadTemperature(record.leadTemperature) !== "Hot") return;

  const lead = await LeadModel.findById(leadId).select("callCount").lean<{ callCount?: number }>();
  await sendHotLeadAlert({
    leadId: leadId.toString(),
    callerName: record.callerName,
    callerNumber: record.callerNumber,
    interestedCourse: record.interestedCourse,
    location: record.location,
    preferredCallbackTime: record.preferredCallbackTime,
    nextAction: record.nextAction,
    summary: record.summary,
    callCount: lead?.callCount ?? 1,
  });
}
