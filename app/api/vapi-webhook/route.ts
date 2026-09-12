/**
 * app/api/vapi-webhook/route.ts
 *
 * POST endpoint that receives Vapi webhook events.
 * When a call ends (message.type === "end-of-call-report"), it:
 *   1. Reads whatever Vapi's own call analysis already extracted
 *      (message.call.analysis.summary / .structuredData).
 *   2. Fills in anything still missing with a Gemini pass over the
 *      transcript (course interest, marks, hostel, location, next action).
 *   3. Writes the resulting record to both Google Sheets and MongoDB.
 *
 * Vapi webhook docs: https://docs.vapi.ai/server-url/events
 */

import { NextRequest, NextResponse } from "next/server";
import { appendCallRecord, type CallRecord } from "@/lib/googleSheets";
import { extractCallData } from "@/lib/extractCallData";
import { connectToDatabase } from "@/lib/mongodb";
import CallRecordModel from "@/models/CallRecord";

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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse the incoming JSON body.
    let body: VapiWebhookPayload;

    try {
      body = (await req.json()) as VapiWebhookPayload;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const { message } = body;

    // 2. Only process end-of-call-report events – silently ack everything else.
    if (!message || message.type !== "end-of-call-report") {
      return NextResponse.json(
        { received: true, processed: false, reason: "Not an end-of-call-report event." },
        { status: 200 }
      );
    }

    const call = message.call;
    const analysis = call?.analysis ?? message.analysis;
    const structuredData = analysis?.structuredData;

    // 3. Pull what Vapi already knows.
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

    // 4. Fill in anything Vapi didn't already give us with an LLM pass
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

    // 5. Write to Google Sheets and MongoDB in parallel — one storage
    //    backend failing shouldn't stop the other from getting the record.
    const [sheetResult, mongoResult] = await Promise.allSettled([
      appendCallRecord(record),
      saveCallRecordToMongo(record, {
        callId: call?.id,
        endedReason: message.endedReason,
        startedAt: call?.startedAt,
        endedAt: call?.endedAt,
        cost: call?.cost,
        rawAnalysis: analysis,
      }),
    ]);

    if (sheetResult.status === "rejected") {
      console.error("[vapi-webhook] Failed to append to Google Sheet:", sheetResult.reason);
    }
    if (mongoResult.status === "rejected") {
      console.error("[vapi-webhook] Failed to save to MongoDB:", mongoResult.reason);
    }

    console.log(
      `[vapi-webhook] Processed call — caller: ${callerNumber}, at: ${timestamp}`
    );

    return NextResponse.json(
      {
        received: true,
        processed: true,
        storage: {
          sheet: sheetResult.status === "fulfilled",
          mongo: mongoResult.status === "fulfilled",
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred.";

    console.error("[vapi-webhook] Error:", message);

    return NextResponse.json(
      { received: true, processed: false, error: message },
      { status: 500 }
    );
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
  rawAnalysis?: VapiAnalysis;
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
