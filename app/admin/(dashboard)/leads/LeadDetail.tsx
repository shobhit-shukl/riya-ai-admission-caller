import type { LeadDetail as LeadDetailData } from "@/lib/leads";
import { formatInAppTimeZone } from "@/lib/time";
import styles from "./leads.module.css";

function formatDateTime(iso: string): string {
  return formatInAppTimeZone(iso, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <div>
          <h2 className={styles.detailName}>{lead.callerName || "Unknown caller"}</h2>
          <p className={styles.detailSubtitle}>{lead.callerNumber || "No phone number captured"}</p>
        </div>
        <span className={styles.detailTimestamp}>{formatDateTime(lead.timestamp)}</span>
      </div>

      <div className={styles.detailGrid}>
        <Field label="Interested course" value={lead.interestedCourse} />
        <Field label="Academic marks" value={lead.academicMarks} />
        <Field label="Hostel required" value={lead.hostelRequired} />
        <Field label="Location" value={lead.location} />
        <Field label="Next action" value={lead.nextAction} />
        <Field label="Caller role" value={lead.callerRole} />
        <Field label="Lead temperature" value={lead.leadTemperature} />
        <Field label="Preferred callback time" value={lead.preferredCallbackTime} />
        <Field label="Ended reason" value={lead.endedReason} />
      </div>

      <div className={styles.detailSection}>
        <span className={styles.fieldLabel}>Call summary</span>
        <p className={styles.detailSummary}>{lead.summary || "No summary available."}</p>
      </div>

      <div className={styles.detailSection}>
        <span className={styles.fieldLabel}>Full transcript</span>
        <pre className={styles.detailTranscript}>
          {lead.transcript || "No transcript available."}
        </pre>
      </div>
    </div>
  );
}
