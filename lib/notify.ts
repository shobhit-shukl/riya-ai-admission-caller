/**
 * lib/notify.ts
 *
 * Emails the admissions team the moment a "Hot" lead finishes a call, or a
 * student on WhatsApp asks for a counsellor, so someone can ring them back
 * while they're still interested. Sent over
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

interface AlertEmail {
  /** e.g. "🔥 Hot lead". Followed by the student's name in the heading. */
  title: string;
  name: string;
  course: string;
  rows: [string, string][];
  summary: string;
  /** Path inside the app, e.g. /admin/leads/123. */
  path: string;
  linkLabel: string;
}

async function sendAlertEmail(alert: AlertEmail): Promise<void> {
  const config = getAlertConfig();
  if (!config) return;

  // Caller-supplied text ends up in the subject line: keep it to one line.
  const name = alert.name.replace(/\s+/g, " ");
  const plainTitle = alert.title.replace(/^\W+/u, "");
  const url = config.appUrl ? `${config.appUrl}${alert.path}` : "";

  const text = [
    `${plainTitle}: ${name}`,
    "",
    ...alert.rows.map(([label, value]) => `${label}: ${value || "—"}`),
    "",
    alert.summary,
    url ? `\n${alert.linkLabel}: ${url}` : "",
  ].join("\n");

  const html = `
    <h2 style="margin:0 0 12px">${escapeHtml(alert.title)}: ${escapeHtml(name)}</h2>
    <table cellpadding="4" style="border-collapse:collapse">
      ${alert.rows
        .map(
          ([label, value]) =>
            `<tr><td style="color:#5c5a6b">${label}</td><td><strong>${escapeHtml(value || "—")}</strong></td></tr>`
        )
        .join("")}
    </table>
    <p>${escapeHtml(alert.summary)}</p>
    ${url ? `<p><a href="${escapeHtml(url)}">${escapeHtml(alert.linkLabel)} →</a></p>` : ""}
  `;

  try {
    await nodemailer.createTransport(config.transport).sendMail({
      from: config.from,
      to: config.to,
      subject: `${alert.title}: ${name}${alert.course ? ` — ${alert.course.replace(/\s+/g, " ")}` : ""}`,
      text,
      html,
    });
  } catch (error: unknown) {
    console.error(`[notify] Failed to send "${plainTitle}" alert:`, error);
  }
}

/** Sends the hot-lead email. Never throws — a failed alert must not lose the lead. */
export async function sendHotLeadAlert(lead: HotLeadAlert): Promise<void> {
  await sendAlertEmail({
    title: "🔥 Hot lead",
    name: lead.callerName || "Unknown caller",
    course: lead.interestedCourse,
    rows: [
      ["Phone", lead.callerNumber],
      ["Course", lead.interestedCourse],
      ["Location", lead.location],
      ["Callback time", lead.preferredCallbackTime],
      ["Next step", lead.nextAction],
      ["Calls so far", String(lead.callCount)],
    ],
    summary: lead.summary,
    path: `/admin/leads/${lead.leadId}`,
    linkLabel: "Open lead in the dashboard",
  });
}

export interface CallbackRequestAlert {
  name: string;
  phone: string;
  course: string;
  city: string;
  summary: string;
}

/** Emails the team when a WhatsApp student asks for a counsellor. Never throws. */
export async function sendCallbackRequestAlert(request: CallbackRequestAlert): Promise<void> {
  const digits = request.phone.replace(/\D/g, "").slice(-10);
  await sendAlertEmail({
    title: "🙋 WhatsApp callback request",
    name: request.name || request.phone,
    course: request.course,
    rows: [
      ["Phone", request.phone],
      ["Course", request.course],
      ["City", request.city],
    ],
    summary: request.summary,
    path: `/admin/website-leads?q=${digits}`,
    linkLabel: "Open in Website leads",
  });
}
