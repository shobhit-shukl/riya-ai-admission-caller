/**
 * app/api/vapi-webhook/route.ts
 *
 * POST endpoint that receives Vapi webhook events.
 * When a call ends (message.type === "end-of-call-report"),
 * it extracts key fields and appends them to a Google Sheet.
 *
 * Vapi webhook docs: https://docs.vapi.ai/server-url/events
 */

import { NextRequest, NextResponse } from "next/server";
import { appendCallRecord } from "@/lib/googleSheets";

// ---------------------------------------------------------------------------
// Vapi payload shape (partial – only the fields we need)
// ---------------------------------------------------------------------------

interface VapiCustomer {
  number?: string;
}

interface VapiCall {
  customer?: VapiCustomer;
  summary?: string;
}

interface VapiMessage {
  type: string;
  call?: VapiCall;
  transcript?: string;
}

interface VapiWebhookPayload {
  message: VapiMessage;
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

    // 3. Extract all fields.
    const callerNumber: string =
      message.call?.customer?.number ?? "Unknown";

    // Vapi does not provide a caller name — leave blank for manual entry.
    const callerName: string = "";

    const summary: string =
      message.call?.summary ?? "No summary available.";

    const transcript: string =
      message.transcript ?? "No transcript available.";

    // Attempt to extract the interested course from the summary.
    // Expand this logic as needed for your use case.
    const interestedCourse: string = "";

    const timestamp: string = new Date().toISOString();

    // 4. Append the record to Google Sheets.
    await appendCallRecord({ timestamp, callerName, callerNumber, interestedCourse, summary, transcript });

    console.log(
      `[vapi-webhook] Row appended — caller: ${callerNumber}, at: ${timestamp}`
    );

    return NextResponse.json(
      { received: true, processed: true },
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
