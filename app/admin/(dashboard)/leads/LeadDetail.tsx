import type { LeadCall, LeadDetail as LeadDetailData } from "@/lib/leads";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/leadPipeline";
import { MAX_CALLBACK_ATTEMPTS } from "@/lib/callbacks";
import { isOutboundCallingConfigured, toE164 } from "@/lib/outboundCalls";
import { appDayKey, formatInAppTimeZone } from "@/lib/time";
import { addLeadNote, updateLeadPipeline } from "./actions";
import CallNowButton from "./CallNowButton";
import { StatusBadge, TemperatureBadge } from "./LeadBadges";
import styles from "./leads.module.css";

function formatDateTime(iso: string): string {
  return formatInAppTimeZone(iso, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(call: LeadCall): string {
  if (!call.startedAt || !call.endedAt) return "";
  const seconds = Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

const DIRECTION_LABELS: Record<string, string> = {
  inbound: "Inbound",
  outbound: "Callback",
  web: "Web call",
};

function callNowDisabledReason(lead: LeadDetailData): string | null {
  if (!isOutboundCallingConfigured()) return "Callbacks aren't set up yet (see Calling setup in the sidebar).";
  if (lead.doNotCall) return "Marked \"Do not call\".";
  if (!toE164(lead.callerNumber)) return "No callable phone number on this lead.";
  return null;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value || "—"}</span>
    </div>
  );
}

export default function LeadDetail({ lead }: { lead: LeadDetailData }) {
  const followUpValue = lead.followUpAt ? appDayKey(new Date(lead.followUpAt)) : "";

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <div>
          <h2 className={styles.detailName}>{lead.callerName || "Unknown caller"}</h2>
          <p className={styles.detailSubtitle}>{lead.callerNumber || "No phone number captured"}</p>
          <div className={styles.badgeRow}>
            <StatusBadge status={lead.status} />
            <TemperatureBadge temperature={lead.leadTemperature} />
          </div>
        </div>
        <span className={styles.detailTimestamp}>
          {lead.callCount} call{lead.callCount === 1 ? "" : "s"} · last {formatDateTime(lead.lastCallAt)}
        </span>
      </div>

      {/* Keyed on the saved values: React resets a form after its action runs,
          and a <select> would otherwise snap back to the value it first mounted with. */}
      <form
        key={`${lead.status}|${followUpValue}|${lead.doNotCall}`}
        action={updateLeadPipeline}
        className={styles.pipelineForm}
      >
        <input type="hidden" name="leadId" value={lead.id} />
        <label className={styles.formField}>
          <span className={styles.fieldLabel}>Status</span>
          <select name="status" defaultValue={lead.status} className={styles.input}>
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {LEAD_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.formField}>
          <span className={styles.fieldLabel}>Follow-up date</span>
          <input type="date" name="followUpDate" defaultValue={followUpValue} className={styles.input} />
        </label>
        <label className={styles.filterCheckbox}>
          <input type="checkbox" name="doNotCall" defaultChecked={lead.doNotCall} />
          Do not call
        </label>
        <button type="submit" className={styles.primaryButton}>
          Save
        </button>
      </form>

      <div className={styles.callbackPanel}>
        <CallNowButton leadId={lead.id} disabledReason={callNowDisabledReason(lead)} />
        {(lead.lastCallbackAt || lead.callbackAttempts > 0) && (
          <span className={styles.noteMeta}>
            {lead.lastCallbackAt ? `Last callback ${formatDateTime(lead.lastCallbackAt)}` : ""}
            {lead.callbackAttempts > 0
              ? ` · ${lead.callbackAttempts}/${MAX_CALLBACK_ATTEMPTS} automatic attempts for this follow-up`
              : ""}
          </span>
        )}
        {lead.lastCallbackError && <span className={styles.callNowError}>{lead.lastCallbackError}</span>}
      </div>

      <div className={styles.detailGrid}>
        <Field label="Interested course" value={lead.interestedCourse} />
        <Field label="Academic marks" value={lead.academicMarks} />
        <Field label="Hostel required" value={lead.hostelRequired} />
        <Field label="Location" value={lead.location} />
        <Field label="Caller role" value={lead.callerRole} />
        <Field label="Preferred callback time" value={lead.preferredCallbackTime} />
        <Field label="Next action" value={lead.nextAction} />
        <Field label="First call" value={formatDateTime(lead.firstCallAt)} />
      </div>

      <div className={styles.detailSection}>
        <span className={styles.fieldLabel}>Latest summary</span>
        <p className={styles.detailSummary}>{lead.summary || "No summary available."}</p>
      </div>

      <div className={styles.detailSection}>
        <span className={styles.fieldLabel}>Notes</span>
        <form action={addLeadNote} className={styles.noteForm}>
          <input type="hidden" name="leadId" value={lead.id} />
          <textarea
            name="text"
            required
            maxLength={2000}
            rows={2}
            placeholder="Add a note, e.g. spoke to parent, visiting campus on Saturday"
            className={styles.input}
          />
          <button type="submit" className={styles.primaryButton}>
            Add note
          </button>
        </form>
        {lead.notes.length > 0 && (
          <ul className={styles.noteList}>
            {lead.notes.map((note) => (
              <li key={note.id} className={styles.note}>
                <p className={styles.noteText}>{note.text}</p>
                <span className={styles.noteMeta}>
                  {note.author || "Admin"} · {formatDateTime(note.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.detailSection}>
        <span className={styles.fieldLabel}>Call history</span>
        {lead.calls.length === 0 ? (
          <p className={styles.muted}>No calls linked to this lead.</p>
        ) : (
          <ol className={styles.callList}>
            {lead.calls.map((call) => {
              const meta = [
                DIRECTION_LABELS[call.direction] ?? "",
                formatDuration(call),
                call.cost !== null ? `$${call.cost.toFixed(2)}` : "",
                call.endedReason,
              ].filter(Boolean);

              return (
                <li key={call.id} className={styles.call}>
                  <div className={styles.callHeader}>
                    <span className={styles.callDate}>{formatDateTime(call.endedAt ?? call.timestamp)}</span>
                    <TemperatureBadge temperature={call.leadTemperature} />
                  </div>
                  {meta.length > 0 && <span className={styles.noteMeta}>{meta.join(" · ")}</span>}
                  <p className={styles.detailSummary}>{call.summary || "No summary available."}</p>
                  <details className={styles.transcriptToggle}>
                    <summary>Transcript</summary>
                    <pre className={styles.detailTranscript}>
                      {call.transcript || "No transcript available."}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
