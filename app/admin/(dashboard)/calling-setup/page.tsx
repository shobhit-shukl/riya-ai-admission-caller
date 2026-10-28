import { connection } from "next/server";
import { checkCallingSetup, isOutboundCallingConfigured, type SetupCheckStatus } from "@/lib/outboundCalls";
import dashboardStyles from "../dashboard.module.css";
import styles from "./calling-setup.module.css";
import TestCallForm from "./TestCallForm";

export const metadata = {
  title: "Calling setup — Sam Admin",
};

const ICONS: Record<SetupCheckStatus, string> = { ok: "✓", warn: "!", fail: "✕", info: "i" };

/**
 * One place to see whether outbound calling is ready: every setting is
 * checked live against Vapi (read-only) on each visit, and the admin can
 * ring their own phone to hear it end to end.
 */
export default async function CallingSetupPage() {
  await connection(); // Env and Vapi state are read per request, never at build time.
  const checks = await checkCallingSetup();
  const failures = checks.filter((check) => check.status === "fail").length;
  const configured = isOutboundCallingConfigured();

  return (
    <div>
      <div className={dashboardStyles.pageHeading}>
        <h1>Calling setup</h1>
        <p>Checks everything Sam needs to make and receive calls. Reload the page after changing a setting.</p>
      </div>

      <p className={`${styles.summary} ${failures === 0 ? styles.summaryReady : styles.summaryNotReady}`}>
        {failures === 0
          ? "✅ Ready. Call buttons work on Leads, Website leads and the Call list."
          : `Not ready yet: ${failures} item${failures === 1 ? "" : "s"} below need${failures === 1 ? "s" : ""} fixing.`}
      </p>

      <section className={styles.card}>
        <h2>Checklist</h2>
        <ul className={styles.checks}>
          {checks.map((check) => (
            <li key={check.label} className={styles.check}>
              <span className={`${styles.icon} ${styles[check.status]}`} aria-label={check.status}>
                {ICONS[check.status]}
              </span>
              <span className={styles.checkLabel}>{check.label}</span>
              <span className={styles.checkDetail}>{check.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.card}>
        <h2>Test call</h2>
        <p>
          Sam calls the number you enter. Talk like a student would, hang up, and the call appears under Leads about a
          minute later. That confirms the whole loop works.
        </p>
        <TestCallForm disabledReason={configured ? null : "Fix the Vapi items above first."} />
      </section>

      <section className={styles.card}>
        <h2>Settings (Vercel → riya-ai-admission-caller → Settings → Environment Variables)</h2>
        <ol className={styles.steps}>
          <li>
            First, in Vapi → Phone Numbers → Create Phone Number, import your Twilio, Telnyx or Vonage number (free
            Vapi numbers can only receive calls). Then open it and, under Inbound Settings, choose Sam as the
            Assistant.
          </li>
          <li>
            <code>VAPI_API_KEY</code>: Vapi → API Keys → <strong>Private</strong> API Keys
          </li>
          <li>
            <code>VAPI_ASSISTANT_ID</code>: the ID under Sam&apos;s name in Vapi → Assistants
          </li>
          <li>
            <code>VAPI_PHONE_NUMBER_ID</code>: Vapi → Phone Numbers → your number → its ID (not the number itself)
          </li>
          <li>
            Optional, for automatic daily callbacks: <code>AUTO_CALLBACKS_ENABLED</code> = <code>true</code> and{" "}
            <code>CRON_SECRET</code> = any long random text
          </li>
          <li>Redeploy (Deployments → ⋯ → Redeploy), then reload this page.</li>
        </ol>
      </section>
    </div>
  );
}
