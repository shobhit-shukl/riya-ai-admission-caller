/**
 * GET /api/bot/knowledge
 *
 * Everything the WhatsApp bot may tell students: active courses from
 * Admin → Courses plus the institution's admission info. The n8n workflow
 * fetches this on every message and puts `text` in the AI's instructions,
 * so edits in the dashboard reach students immediately.
 *
 * Auth: `Authorization: Bearer <BOT_API_SECRET>`.
 *
 * Response: 200 { institutionName, text, courses: [{ name, level, admissionsOpen }], updatedAt }
 */

import { NextRequest, NextResponse } from "next/server";
import { checkBotAuth } from "@/lib/botAuth";
import { buildBotKnowledge } from "@/lib/courses";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = checkBotAuth(req);
  if (denied) return denied;

  try {
    return NextResponse.json(await buildBotKnowledge(), { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    console.error("[bot] Failed to build knowledge:", error);
    return NextResponse.json({ error: "Couldn't load courses." }, { status: 500 });
  }
}
