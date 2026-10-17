/**
 * GET /api/cron/callbacks
 *
 * Rings leads whose follow-up date has arrived (see lib/callbacks.ts).
 * Triggered by Vercel Cron (vercel.json), which sends
 * `Authorization: Bearer $CRON_SECRET`. Any other scheduler can call it
 * the same way.
 *
 * Does nothing unless AUTO_CALLBACKS_ENABLED=true and outbound calling is
 * configured (VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID).
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAutoCallbackEnabled, isWithinCallingHours, runScheduledCallbacks } from "@/lib/callbacks";
import { isOutboundCallingConfigured } from "@/lib/outboundCalls";

export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

function batchLimit(): number {
  const value = Number(process.env.CALLBACK_BATCH_LIMIT);
  return Number.isInteger(value) && value > 0 ? Math.min(value, 25) : 10;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // This endpoint places real phone calls, so it never runs without a secret.
  const secret = process.env.CRON_SECRET?.trim();
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!secret || !provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isAutoCallbackEnabled()) {
    return NextResponse.json({ ran: false, reason: "AUTO_CALLBACKS_ENABLED is not true." });
  }
  if (!isOutboundCallingConfigured()) {
    return NextResponse.json({ ran: false, reason: "Outbound calling is not configured." });
  }
  if (!isWithinCallingHours()) {
    return NextResponse.json({ ran: false, reason: "Outside calling hours." });
  }

  const result = await runScheduledCallbacks(batchLimit());
  console.log(
    `[cron/callbacks] started ${result.started.length}, failed ${result.failed.length}`,
    result.failed.length ? result.failed : ""
  );

  return NextResponse.json({ ran: true, ...result });
}
