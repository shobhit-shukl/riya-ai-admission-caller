/**
 * lib/botAuth.ts
 *
 * Shared-secret check for the WhatsApp bot's endpoints (/api/bot/*), called
 * by the n8n workflow with `Authorization: Bearer <BOT_API_SECRET>`. Like the
 * other webhooks, a missing secret rejects everything in production but lets
 * requests through in development so they can be tried with curl.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/** Returns an error response to send back, or null if the request may proceed. */
export function checkBotAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.BOT_API_SECRET?.trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      console.error("[bot] BOT_API_SECRET is not set — rejecting request.");
      return NextResponse.json({ error: "The WhatsApp bot API is not configured." }, { status: 500 });
    }
    return null;
  }

  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}
