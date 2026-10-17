/**
 * lib/notify.ts
 *
 * Emails the admissions team the moment a "Hot" lead finishes a call, so a
 * counselor can ring them back while they're still interested. Sent over
 * plain SMTP (works with Gmail app passwords, Zoho, Outlook, SES, etc.).
 *
 * Optional: if SMTP_HOST or ALERT_EMAIL_TO isn't set, alerts are skipped.
 */

import nodemailer from "nodemailer";

export interface HotLeadAlert {
  leadId: string;
  callerName: string;
  callerNumber: string;
  interestedCourse: string;
  location: string;
  preferredCallbackTime: string;
  nextAction: string;
  summary: string;
  callCount: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getAlertConfig() {
  const host = process.env.SMTP_HOST;
  const to = process.env.ALERT_EMAIL_TO;
  if (!host || !to) return null;

  const port = Number(process.env.SMTP_PORT || 465);
  return {
    to,
    from: process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER || to,
    appUrl: process.env.APP_URL?.replace(/\/+$/, ""),
    transport: {
      host,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    },
  };
}

/** Sends the hot-lead email. Never throws — a failed alert must not lose the lead. */
export async function sendHotLeadAlert(lead: HotLeadAlert): Promise<void> {
  const config = getAlertConfig();
  if (!config) return;

  // Caller-supplied text ends up in the subject line: keep it to one line.
  const name = (lead.callerName || "Unknown caller").replace(/\s+/g, " ");
  const rows: [string, string][] = [
    ["Phone", lead.callerNumber],
    ["Course", lead.interestedCourse],
    ["Location", lead.location],
    ["Callback time", lead.preferredCallbackTime],
    ["Next step", lead.nextAction],
    ["Calls so far", String(lead.callCount)],
  ];
  const leadUrl = config.appUrl ? `${config.appUrl}/admin/leads/${lead.leadId}` : "";

  const text = [
    `Hot lead: ${name}`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value || "—"}`),
    "",
    lead.summary,
    leadUrl ? `\nOpen lead: ${leadUrl}` : "",
  ].join("\n");

  const html = `
    <h2 style="margin:0 0 12px">🔥 Hot lead: ${escapeHtml(name)}</h2>
    <table cellpadding="4" style="border-collapse:collapse">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="color:#5c5a6b">${label}</td><td><strong>${escapeHtml(value || "—")}</strong></td></tr>`
        )
        .join("")}
    </table>
    <p>${escapeHtml(lead.summary)}</p>
    ${leadUrl ? `<p><a href="${escapeHtml(leadUrl)}">Open lead in the dashboard →</a></p>` : ""}
  `;

  try {
    await nodemailer.createTransport(config.transport).sendMail({
      from: config.from,
      to: config.to,
      subject: `🔥 Hot lead: ${name}${lead.interestedCourse ? ` — ${lead.interestedCourse}` : ""}`,
      text,
      html,
    });
  } catch (error: unknown) {
    console.error("[notify] Failed to send hot-lead alert:", error);
  }
}
