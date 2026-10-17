/**
 * lib/outboundCalls.ts
 *
 * Starts outbound callbacks: the assistant (Sam/Riya) phones a lead back
 * through Vapi's REST API. When the call ends, Vapi sends the usual
 * end-of-call report to /api/vapi-webhook, which files it under the same
 * lead (matched by phone number) like any other call.
 *
 * Dormant until configured: without VAPI_API_KEY, VAPI_ASSISTANT_ID and
 * VAPI_PHONE_NUMBER_ID nothing here makes a call, and the dashboard shows
 * the "Call now" button as not set up yet.
 *
 * Vapi docs: https://docs.vapi.ai/api-reference/calls/create
 */

const REQUEST_TIMEOUT_MS = 15_000;

/** VAPI_API_BASE_URL only exists to point local tests at a fake Vapi. */
function vapiCallUrl(): string {
  return `${(process.env.VAPI_API_BASE_URL?.trim() || "https://api.vapi.ai").replace(/\/+$/, "")}/call`;
}

interface OutboundConfig {
  apiKey: string;
  assistantId: string;
  phoneNumberId: string;
  defaultCountryCode: string;
}

function getOutboundConfig(): OutboundConfig | null {
  const apiKey = process.env.VAPI_API_KEY?.trim();
  const assistantId = process.env.VAPI_ASSISTANT_ID?.trim();
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
  if (!apiKey || !assistantId || !phoneNumberId) return null;

  return {
    apiKey,
    assistantId,
    phoneNumberId,
    defaultCountryCode: (process.env.DEFAULT_COUNTRY_CODE || "91").replace(/\D/g, ""),
  };
}

/** True once the three Vapi variables are set — the switch for every callback feature. */
export function isOutboundCallingConfigured(): boolean {
  return getOutboundConfig() !== null;
}

/**
 * Converts a stored number to E.164, which Vapi requires. Numbers already in
 * international form keep their country code; bare 10-digit numbers (and
 * 0-prefixed ones like 09876543210) get DEFAULT_COUNTRY_CODE (India, 91).
 * Returns null if it doesn't look like a callable number.
 */
export function toE164(phone: string, defaultCountryCode = "91"): string | null {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+${defaultCountryCode}${digits.slice(1)}`;
  if (digits.length === 10 + defaultCountryCode.length && digits.startsWith(defaultCountryCode)) {
    return `+${digits}`;
  }
  return null;
}

export interface CallbackLead {
  id: string;
  callerName: string;
  callerNumber: string;
  interestedCourse: string;
}

export type CallbackTrigger = "manual" | "scheduled";

export type StartCallResult = { ok: true; callId: string } | { ok: false; error: string };

/** What Sam opens a callback with — personal, so the student knows why we're calling. */
export function buildCallbackGreeting(lead: CallbackLead): string {
  const firstName = lead.callerName.trim().split(/\s+/)[0];
  const hello = firstName ? `Hello ${firstName}` : "Hello";
  const about = lead.interestedCourse ? ` about ${lead.interestedCourse} admissions` : "";
  return `${hello}, this is Sam from Maya Devi University, calling you back${about}. Is this a good time to talk for two minutes?`;
}

/** Asks Vapi to phone the lead now. Never throws. */
export async function startOutboundCall(lead: CallbackLead, trigger: CallbackTrigger): Promise<StartCallResult> {
  const config = getOutboundConfig();
  if (!config) return { ok: false, error: "Outbound calling isn't set up yet." };

  const number = toE164(lead.callerNumber, config.defaultCountryCode);
  if (!number) return { ok: false, error: `"${lead.callerNumber || "No number"}" isn't a callable phone number.` };

  const greeting = buildCallbackGreeting(lead);

  try {
    const response = await fetch(vapiCallUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Callback (${trigger}) — ${lead.callerName || number}`.slice(0, 40),
        assistantId: config.assistantId,
        phoneNumberId: config.phoneNumberId,
        customer: { number, ...(lead.callerName ? { name: lead.callerName.slice(0, 40) } : {}) },
        assistantOverrides: {
          firstMessage: greeting,
          // Don't pay to talk to an answering machine: leave a short message and hang up.
          voicemailDetection: { provider: "vapi" },
          voicemailMessage:
            "Hello, this is Sam from Maya Devi University returning your admission enquiry. " +
            "Please call us back whenever it suits you. Thank you!",
          metadata: { leadId: lead.id, trigger },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body = (await response.json().catch(() => null)) as { id?: string; message?: unknown } | null;

    if (!response.ok || !body?.id) {
      const detail = Array.isArray(body?.message) ? body.message.join("; ") : String(body?.message ?? "");
      return { ok: false, error: `Vapi returned ${response.status}${detail ? `: ${detail}` : ""}`.slice(0, 300) };
    }

    return { ok: true, callId: body.id };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Couldn't reach Vapi: ${reason}`.slice(0, 300) };
  }
}
