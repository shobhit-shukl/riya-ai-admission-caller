import type { LeadDetail as LeadDetailData } from "@/lib/leads";
import styles from "./leads.module.css";

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
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
