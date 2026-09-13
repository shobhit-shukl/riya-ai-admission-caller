/**
 * app/api/test-gemini/route.ts
 *
 * Quick connectivity test — confirms GEMINI_API_KEY is configured and
 * valid by sending a trivial, minimal-token prompt. Writes no lead data.
 */

import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Missing GEMINI_API_KEY environment variable." },
      { status: 500 }
    );
  }

  try {
    const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { success: false, error: `Gemini API error ${response.status}: ${detail}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: `✅ Gemini connection verified successfully (model: ${modelName}).` },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[test-gemini] Error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
