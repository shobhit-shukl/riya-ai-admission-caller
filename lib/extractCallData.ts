/**
 * lib/extractCallData.ts
 *
 * Best-effort structured-data extraction over a call transcript, used as
 * a fallback for whatever fields Vapi's own `analysis.structuredData`
 * (configured via the assistant's analysisPlan) didn't already provide.
 *
 * Uses the Gemini API directly over `fetch` — no SDK dependency needed.
 */

export interface ExtractedCallData {
  callerName: string;
  interestedCourse: string;
  academicMarks: string;
  hostelRequired: string;
  location: string;
  nextAction: string;
  summary: string;
}

const EMPTY_EXTRACTION: ExtractedCallData = {
  callerName: "",
  interestedCourse: "",
  academicMarks: "",
  hostelRequired: "",
  location: "",
  nextAction: "",
  summary: "",
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    callerName: {
      type: "STRING",
      description:
        "The caller's name if they mentioned it in any language (e.g. \"मेरा नाम राहुल है\" / \"my name is Rahul\"), transliterated to Roman script. Otherwise an empty string.",
    },
    interestedCourse: {
      type: "STRING",
      description:
        "The course or program the caller asked about, in Roman script (e.g. Hindi \"बीटेक\" -> \"B.Tech\"), otherwise an empty string.",
    },
    academicMarks: {
      type: "STRING",
      description:
        "The caller's academic marks/percentage/CGPA if mentioned, converting spoken-out numbers in any language to digits (e.g. \"पचहत्तर प्रतिशत\" -> \"75%\"), otherwise an empty string.",
    },
    hostelRequired: {
      type: "STRING",
      enum: ["Yes", "No", "Unknown"],
      description: "Whether the caller needs hostel accommodation.",
    },
    location: {
      type: "STRING",
      description:
        "The caller's current city/location if mentioned in any language (e.g. \"मैं पुणे से हूं\" / \"I'm from Pune\"), transliterated to Roman script. Otherwise an empty string.",
    },
    nextAction: {
      type: "STRING",
      description: "The agreed follow-up step for this lead, otherwise an empty string.",
    },
    summary: {
      type: "STRING",
      description: "A one to two sentence summary of the call, written in English regardless of the call's language.",
    },
  },
  required: [
    "callerName",
    "interestedCourse",
    "academicMarks",
    "hostelRequired",
    "location",
    "nextAction",
    "summary",
  ],
};

/**
 * Extracts structured lead data from a call transcript using Gemini.
 * Never throws — returns an all-empty result on any failure so the
 * webhook can still log the raw transcript even if extraction fails.
 */
export async function extractCallData(
  transcript: string,
  existingSummary: string
): Promise<ExtractedCallData> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !transcript.trim()) {
    return EMPTY_EXTRACTION;
  }

  const modelName = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  const prompt = `You are reading a transcript of a phone call between an AI admissions counselor ("AI"/"Riya") and a prospective student ("User"). Read the call summary and transcript below and extract the requested fields.

The transcript may be in Hindi (Devanagari script), English, romanized Hindi, or a mix of these switching mid-sentence — this is normal for Indian admissions calls. Understand all of them. Whatever field values you extract (name, location, course, etc.), write them out in Roman script / English so they're consistent and readable in a spreadsheet, even if the caller said them in Hindi. Convert spoken-out numbers and Hindi number words to digits (e.g. "पचहत्तर प्रतिशत" or "pachattar percent" -> "75%").

Use an empty string for any field with no information available in the call, except hostelRequired which must always be "Yes", "No", or "Unknown".

Existing call summary (may be empty): ${existingSummary}

Transcript:
${transcript}`;

  // The webhook needs to write to Sheets/MongoDB right after the call ends —
  // don't let a slow or hanging Gemini request hold that up. Fall back to
  // whatever Vapi already gave us if this doesn't finish quickly.
  const timeoutMs = 10_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.error(
        `[extractCallData] Gemini API error ${response.status}: ${await response.text()}`
      );
      return EMPTY_EXTRACTION;
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return EMPTY_EXTRACTION;
    }

    const parsed = JSON.parse(text) as Partial<ExtractedCallData>;
    return { ...EMPTY_EXTRACTION, ...parsed };
  } catch (error: unknown) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : error;
    console.error("[extractCallData] Failed to extract structured call data:", reason);
    return EMPTY_EXTRACTION;
  } finally {
    clearTimeout(timeout);
  }
}
