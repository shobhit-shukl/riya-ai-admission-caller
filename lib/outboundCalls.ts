/**
 * lib/outboundCalls.ts
 *
 * Starts outbound callbacks: the assistant (Sam) phones a lead back
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
function vapiUrl(path: string): string {
  return `${(process.env.VAPI_API_BASE_URL?.trim() || "https://api.vapi.ai").replace(/\/+$/, "")}${path}`;
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

/**
 * manual / scheduled: calling back a lead who contacted us.
 * call-list: first call to a contact uploaded by an admin (models/Contact.ts).
 * website: calling someone who enquired on the university website (models/WebsiteLead.ts).
 * test: the admin's own number, from the Calling setup page.
 *
 * The id travels in the call's metadata, so the end-of-call webhook can
 * record the outcome (answered / no answer) on the right record.
 */
export type CallbackTrigger = "manual" | "scheduled" | "call-list" | "website" | "test";

const METADATA_KEY: Record<CallbackTrigger, string> = {
  manual: "leadId",
  scheduled: "leadId",
  "call-list": "contactId",
  website: "websiteLeadId",
  test: "testCall",
};

/**
 * `systemic` marks failures that aren't the student's fault — calling not
 * set up, a rejected API key, Vapi down or rate-limiting — so the scheduler
 * can stop instead of using up every lead's attempts on the same problem.
 */
export type StartCallResult = { ok: true; callId: string } | { ok: false; error: string; systemic?: boolean };

/** What Sam opens with — personal, so the student knows why we're calling. */
export function buildCallbackGreeting(lead: CallbackLead, trigger: CallbackTrigger = "manual"): string {
  const firstName = lead.callerName.trim().split(/\s+/)[0];
  const hello = firstName ? `Hello ${firstName}` : "Hello";

  if (trigger === "call-list") {
    const about = lead.interestedCourse ? ` about our ${lead.interestedCourse} programme` : " about admissions";
    return `${hello}, this is Sam from Maya Devi University, Dehradun. I'm calling${about} for the upcoming session. Is this a good time to talk for two minutes?`;
  }

  if (trigger === "test") {
    return "Hello, this is Sam from Maya Devi University. This is a test call from the admin panel. Talk to me as a student would, and the call will show up under Leads.";
  }

  if (trigger === "website") {
    const about = lead.interestedCourse ? ` about ${lead.interestedCourse}` : "";
    return `${hello}, this is Sam from Maya Devi University. Thank you for your enquiry on our website${about}. Is this a good time to talk for two minutes?`;
  }

  const about = lead.interestedCourse ? ` about ${lead.interestedCourse} admissions` : "";
  return `${hello}, this is Sam from Maya Devi University, calling you back${about}. Is this a good time to talk for two minutes?`;
}

/** Asks Vapi to phone the lead now. Never throws. */
export async function startOutboundCall(lead: CallbackLead, trigger: CallbackTrigger): Promise<StartCallResult> {
  const config = getOutboundConfig();
  if (!config) return { ok: false, error: "Outbound calling isn't set up yet.", systemic: true };

  const number = toE164(lead.callerNumber, config.defaultCountryCode);
  if (!number) return { ok: false, error: `"${lead.callerNumber || "No number"}" isn't a callable phone number.` };

  const greeting = buildCallbackGreeting(lead, trigger);
  const voicemailMessage =
    trigger === "call-list"
      ? "Hello, this is Sam from Maya Devi University, Dehradun, calling about admissions for the upcoming session. " +
        "Please call us back whenever it suits you. Thank you!"
      : "Hello, this is Sam from Maya Devi University returning your admission enquiry. " +
        "Please call us back whenever it suits you. Thank you!";

  try {
    const response = await fetch(vapiUrl("/call"), {
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
          voicemailMessage,
          metadata: { [METADATA_KEY[trigger]]: lead.id, trigger },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body = (await response.json().catch(() => null)) as { id?: string; message?: unknown } | null;

    if (!response.ok || !body?.id) {
      const detail = Array.isArray(body?.message) ? body.message.join("; ") : String(body?.message ?? "");
      return {
        ok: false,
        error: `${describeVapiStatus(response.status)}${detail ? `: ${detail}` : ""}`.slice(0, 300),
        // A 400 is about this call's details (usually the number); anything else affects every call.
        systemic: response.status !== 400,
      };
    }

    return { ok: true, callId: body.id };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Couldn't reach Vapi: ${reason}`.slice(0, 300), systemic: true };
  }
}

function describeVapiStatus(status: number): string {
  if (status === 401 || status === 403) return `Vapi rejected the API key (${status}), check VAPI_API_KEY is the Private key`;
  if (status === 404) return "Vapi couldn't find the assistant or phone number (404), check VAPI_ASSISTANT_ID and VAPI_PHONE_NUMBER_ID";
  if (status === 429) return "Vapi is limiting calls right now (429), too many at once";
  return `Vapi returned ${status}`;
}

// ---------------------------------------------------------------------------
// Setup check (Admin → Calling setup). Only reads from Vapi; never places a call.
// ---------------------------------------------------------------------------

export type SetupCheckStatus = "ok" | "warn" | "fail" | "info";

export interface SetupCheck {
  label: string;
  status: SetupCheckStatus;
  detail: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function vapiGet<T>(path: string, apiKey: string): Promise<{ status: number; body: T | null }> {
  try {
    const response = await fetch(vapiUrl(path), {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as T | null };
  } catch {
    return { status: 0, body: null };
  }
}

function vapiGetProblem(what: string, status: number): string {
  if (status === 0) return `Couldn't reach Vapi to look up the ${what}.`;
  if (status === 401 || status === 403) return "Vapi rejected the API key. Use a key from Vapi → API Keys → Private API Keys (not a Public one).";
  if (status === 404 || status === 400) return `Vapi has no ${what} with this ID. Copy it again from the Vapi dashboard.`;
  return `Vapi returned ${status} when looking up the ${what}.`;
}

interface VapiAssistantInfo {
  name?: string;
  server?: { url?: string };
  serverMessages?: string[];
}

interface VapiPhoneNumberInfo {
  number?: string;
  name?: string;
  sipUri?: string;
  provider?: string;
  status?: string;
  assistantId?: string | null;
}

function webhookCheck(serverUrl: string): SetupCheck {
  const label = "Call results reach the admin app";
  const url = serverUrl.replace(/\/+$/, "");
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, "");

  if (!url) {
    return { label, status: "fail", detail: "Sam has no Server URL, so finished calls never reach this app. In Vapi → Assistants → Sam → Advanced → Webhook Server, set Server URL to …/api/vapi-webhook and publish." };
  }
  if (!url.endsWith("/api/vapi-webhook")) {
    return { label, status: "fail", detail: `Sam's Server URL is ${url}. It should end in /api/vapi-webhook.` };
  }
  if (appUrl && url !== `${appUrl}/api/vapi-webhook`) {
    return { label, status: "warn", detail: `Sam's Server URL is ${url}, but this app is ${appUrl}.` };
  }
  return { label, status: "ok", detail: `Sam sends finished calls to ${url}.` };
}

async function assistantChecks(apiKey: string, assistantId: string): Promise<SetupCheck[]> {
  const { status, body } = await vapiGet<VapiAssistantInfo>(`/assistant/${encodeURIComponent(assistantId)}`, apiKey);
  if (status !== 200 || !body) return [{ label: "Assistant", status: "fail", detail: vapiGetProblem("assistant", status) }];

  const checks: SetupCheck[] = [
    { label: "Assistant", status: "ok", detail: `Found "${body.name ?? "Unnamed"}".` },
    webhookCheck(body.server?.url ?? ""),
  ];
  if (Array.isArray(body.serverMessages) && !body.serverMessages.includes("end-of-call-report")) {
    checks.push({
      label: "End-of-call report",
      status: "fail",
      detail: "Sam's Server Messages don't include \"end-of-call-report\", so calls won't be saved. Add it in Vapi → Assistants → Sam → Advanced (Server Messages) and publish.",
    });
  }
  return checks;
}

async function phoneNumberChecks(apiKey: string, phoneNumberId: string, assistantId: string): Promise<SetupCheck[]> {
  const { status, body } = await vapiGet<VapiPhoneNumberInfo>(`/phone-number/${encodeURIComponent(phoneNumberId)}`, apiKey);
  if (status !== 200 || !body) return [{ label: "Phone number", status: "fail", detail: vapiGetProblem("phone number", status) }];

  const shown = `${body.number || body.sipUri || body.name || "Unnamed number"}${body.provider ? ` (${body.provider})` : ""}`;
  const checks: SetupCheck[] = [
    body.status && body.status !== "active"
      ? { label: "Phone number", status: "fail", detail: `${shown} is "${body.status}" in Vapi. It must be active to call.` }
      : { label: "Phone number", status: "ok", detail: `${shown} is active.` },
  ];

  // Free Vapi numbers are inbound-only (US area codes): every Call button would fail.
  if (body.provider === "vapi") {
    checks.push({
      label: "Outbound calls",
      status: "fail",
      detail: "This is a free Vapi number, which can only receive calls. Import a Twilio, Telnyx or Vonage number (Vapi → Phone Numbers → Create Phone Number) and use its ID instead.",
    });
  }

  checks.push(
    body.assistantId === assistantId
      ? { label: "Incoming calls", status: "ok", detail: "Students who call this number back talk to Sam." }
      : {
          label: "Incoming calls",
          status: "warn",
          detail: "This number isn't assigned to Sam, so students who call it back won't be answered. In Vapi → Phone Numbers → this number → Inbound Settings, choose Sam as the Assistant and save.",
        }
  );
  return checks;
}

/** Everything that has to be right for calls to work, checked live against Vapi. */
export async function checkCallingSetup(): Promise<SetupCheck[]> {
  const apiKey = process.env.VAPI_API_KEY?.trim();
  const assistantId = process.env.VAPI_ASSISTANT_ID?.trim();
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
  const checks: SetupCheck[] = [];

  if (!apiKey) {
    checks.push({ label: "Vapi API key", status: "fail", detail: "Add VAPI_API_KEY (Vapi → API Keys → Private API Keys)." });
  }

  if (!assistantId) {
    checks.push({ label: "Assistant", status: "fail", detail: "Add VAPI_ASSISTANT_ID (the ID under Sam's name in Vapi)." });
  }

  if (!phoneNumberId) {
    checks.push({
      label: "Phone number",
      status: "fail",
      detail: "Add VAPI_PHONE_NUMBER_ID (the ID of the number in Vapi → Phone Numbers, not the number itself).",
    });
  } else if (!UUID_PATTERN.test(phoneNumberId)) {
    checks.push({
      label: "Phone number",
      status: "fail",
      detail: "VAPI_PHONE_NUMBER_ID should be the number's ID from Vapi (looks like 1a2b3c4d-…), not the phone number itself.",
    });
  }

  if (apiKey && assistantId) {
    const [assistant, phone] = await Promise.all([
      assistantChecks(apiKey, assistantId),
      phoneNumberId && UUID_PATTERN.test(phoneNumberId) ? phoneNumberChecks(apiKey, phoneNumberId, assistantId) : [],
    ]);
    // A rejected key fails both lookups the same way; say it once.
    const keyRejected = assistant[0].status === "fail" && /API key/.test(assistant[0].detail);
    checks.push(
      keyRejected
        ? { label: "Vapi API key", status: "fail", detail: assistant[0].detail }
        : { label: "Vapi API key", status: "ok", detail: "Vapi accepted the key." },
      ...(keyRejected ? [] : [...assistant, ...phone])
    );
  }

  checks.push(
    process.env.VAPI_WEBHOOK_SECRET?.trim()
      ? { label: "Webhook secret", status: "ok", detail: "VAPI_WEBHOOK_SECRET is set." }
      : { label: "Webhook secret", status: "fail", detail: "VAPI_WEBHOOK_SECRET is missing, so this app rejects every finished call." }
  );

  const autoOn = process.env.AUTO_CALLBACKS_ENABLED?.trim().toLowerCase() === "true";
  const hasCronSecret = Boolean(process.env.CRON_SECRET?.trim());
  checks.push(
    !autoOn
      ? {
          label: "Automatic callbacks",
          status: "info",
          detail: "Off: Sam only calls when you press a Call button. Set AUTO_CALLBACKS_ENABLED=true and CRON_SECRET to ring due follow-ups daily.",
        }
      : hasCronSecret
        ? { label: "Automatic callbacks", status: "ok", detail: "On: due follow-ups are called once a day, late morning IST, Mon–Sat." }
        : { label: "Automatic callbacks", status: "fail", detail: "AUTO_CALLBACKS_ENABLED is true but CRON_SECRET is missing, so the daily run is refused." }
  );

  return checks;
}
