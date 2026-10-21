/**
 * POST /api/website-leads
 *
 * Receives enquiries from the university website's backend (server to
 * server — never call this from the browser, it would expose the secret).
 *
 * Auth: `Authorization: Bearer <WEBSITE_LEADS_SECRET>`. In production a
 * missing secret rejects everything, same as the Vapi webhook.
 *
 * Body (JSON):
 *   name*, phone*, email, course, city, message,
 *   formType ("enquiry" | "apply" | "callback" | "brochure" | "contact"),
 *   sourcePage, utmSource, utmMedium, utmCampaign,
 *   submittedAt (ISO string), externalId (website's id, makes retries safe)
 *
 * Responses: 201 { id } created · 200 { id, duplicate: true } already
 * received · 400 { errors } invalid · 401 unauthorized.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { parseWebsiteLead, saveWebsiteLead } from "@/lib/websiteLeads";

function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.WEBSITE_LEADS_SECRET?.trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      console.error("[website-leads] WEBSITE_LEADS_SECRET is not set — rejecting request.");
      return NextResponse.json({ error: "Website leads intake is not configured." }, { status: 500 });
    }
  } else {
    const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!provided || !safeEqual(provided, expected)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseWebsiteLead(body);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  try {
    const { id, duplicate } = await saveWebsiteLead(parsed.lead);
    return NextResponse.json({ id, duplicate }, { status: duplicate ? 200 : 201 });
  } catch (error: unknown) {
    console.error("[website-leads] Failed to save:", error);
    return NextResponse.json({ error: "Couldn't save the enquiry." }, { status: 500 });
  }
}
