/**
 * app/api/vapi-webhook/route.ts
 *
 * POST endpoint that receives Vapi webhook events.
 * When a call ends (message.type === "end-of-call-report"), it:
 *   1. Verifies the request really came from Vapi (shared secret).
 *   2. Acknowledges immediately, then — after the response is sent —
 *      reads whatever Vapi's own call analysis already extracted
 *      (message.call.analysis.summary / .structuredData).
 *   3. Fills in anything still missing with a Gemini pass over the
 *      transcript (course interest, marks, hostel, location, next action).
 *   4. Writes the resulting record to MongoDB, then Google Sheets —
 *      skipping both if this call was already recorded (Vapi retries).
 *
 * Vapi webhook docs: https://docs.vapi.ai/server-url/events
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { appendCallRecord, type CallRecord } from "@/lib/googleSheets";
import { extractCallData } from "@/lib/extractCallData";
import { connectToDatabase } from "@/lib/mongodb";
import CallRecordModel from "@/models/CallRecord";

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
  customer?: VapiCustomer;
  analysis?: VapiAnalysis;
  startedAt?: string;
  endedAt?: string;
  cost?: number;
}

interface VapiArtifact {
  transcript?: string;
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

function safeEqual(a: string, b: string): boolean {
  // Hash first so the comparison is constant-time regardless of length.
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * Checks the shared secret configured on the Vapi assistant's Server URL.
 * Vapi sends it as `x-vapi-secret` (server secret) or as a Bearer token
 * (Bearer-token server credential); either is accepted.
 *
 * Without VAPI_WEBHOOK_SECRET, anyone who finds the URL could POST fake
 * leads — so in production a missing secret rejects every request rather
 * than silently accepting them.
 */
function isAuthorizedVapiRequest(req: NextRequest): { ok: true } | { ok: false; status: number } {
  const expected = process.env.VAPI_WEBHOOK_SECRET;

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      console.error("[vapi-webhook] VAPI_WEBHOOK_SECRET is not set — rejecting request.");
      return { ok: false, status: 500 };
    }
    return { ok: true }; // Local development without a secret.
  }

  const headerSecret = req.headers.get("x-vapi-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const provided = headerSecret ?? bearer;

  if (provided && safeEqual(provided, expected)) {
    return { ok: true };
  }

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

  if (call?.id && (await isAlreadyRecorded(call.id))) {
    console.warn(`[vapi-webhook] Call ${call.id} already recorded — skipping duplicate delivery.`);
    return;
  }

  // 1. Pull what Vapi already knows.
  const callerNumber: string = call?.customer?.number ?? "Unknown";
  const transcript: string =
    message.artifact?.transcript ?? message.transcript ?? "No transcript available.";

  let callerName: string = call?.customer?.name ?? "";
  let summary: string = analysis?.summary ?? message.summary ?? "";
  let interestedCourse = readStructuredField(structuredData, [
    "interestedCourse",
    "courseInterest",
    "course",
  ]);
  let academicMarks = readStructuredField(structuredData, ["academicMarks", "marks"]);
  let hostelRequired = readStructuredField(structuredData, ["hostelRequired", "hostel"]);
  let location = readStructuredField(structuredData, ["location", "city"]);
  let nextAction = readStructuredField(structuredData, ["nextAction", "followUp"]);

  // 2. Fill in anything Vapi didn't already give us with an LLM pass
  //    over the transcript — this is what actually populates the sheet
  //    when the assistant isn't configured with a structuredDataSchema.
  const hasEverything =
    callerName && summary && interestedCourse && academicMarks && hostelRequired && location && nextAction;

  if (!hasEverything) {
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
  };

  // 3. MongoDB first: its unique callId index tells us whether this call
  //    was already recorded by an earlier delivery of the same webhook.
  //    Any other MongoDB failure shouldn't stop the record reaching the
  //    sheet, so only a duplicate skips the sheet write.
  try {
    await saveCallRecordToMongo(record, {
      callId: call?.id,
      endedReason: message.endedReason,
      startedAt: call?.startedAt,
      endedAt: call?.endedAt,
      cost: call?.cost,
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

  console.log(`[vapi-webhook] Processed call ${call?.id ?? "(no id)"} at ${timestamp}`);
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
  rawAnalysis?: VapiAnalysis;
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

async function saveCallRecordToMongo(record: CallRecord, meta: CallRecordMeta): Promise<void> {
  await connectToDatabase();

  await CallRecordModel.create({
    ...record,
    timestamp: new Date(record.timestamp),
    callId: meta.callId,
    endedReason: meta.endedReason,
    startedAt: meta.startedAt ? new Date(meta.startedAt) : undefined,
    endedAt: meta.endedAt ? new Date(meta.endedAt) : undefined,
    cost: meta.cost,
    rawAnalysis: meta.rawAnalysis,
  });
}
