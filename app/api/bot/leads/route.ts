/**
 * POST /api/bot/leads
 *
 * The WhatsApp bot saves (or updates) the student it's chatting with. They
 * appear under Admin → Website leads as form "WhatsApp", one per number,
 * where counsellors can set a status and have Sam call them.
 *
 * Auth: `Authorization: Bearer <BOT_API_SECRET>`.
 *
 * Body (JSON):
 *   phone* (the student's WhatsApp number), name, email, course, city,
 *   message (summary of what they want), wantsCallback (true when they
 *   ask for a counsellor — emails the team once, if alerts are set up)
 *
 * Responses: 201 { id } new enquiry · 200 { id } updated · 400 { errors } invalid · 401 unauthorized.
 */

import { after, NextRequest, NextResponse } from "next/server";
import { checkBotAuth } from "@/lib/botAuth";
import { sendCallbackRequestAlert } from "@/lib/notify";
import { parseWhatsAppLead, saveWhatsAppLead } from "@/lib/websiteLeads";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = checkBotAuth(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseWhatsAppLead(body);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  try {
    const { id, created, newCallbackRequest } = await saveWhatsAppLead(parsed.lead);

    if (newCallbackRequest) {
      const { name, phone, course, city, message } = parsed.lead;
      after(() => sendCallbackRequestAlert({ name, phone, course, city, summary: message }));
    }

    return NextResponse.json({ id }, { status: created ? 201 : 200 });
  } catch (error: unknown) {
    console.error("[bot] Failed to save WhatsApp lead:", error);
    return NextResponse.json({ error: "Couldn't save the enquiry." }, { status: 500 });
  }
}
