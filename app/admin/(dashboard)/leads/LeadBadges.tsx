import { LEAD_STATUS_LABELS, normalizeLeadTemperature, type LeadStatus } from "@/lib/leadPipeline";
import styles from "./leads.module.css";

const STATUS_CLASS: Record<LeadStatus, string> = {
  new: styles.statusNew,
  contacted: styles.statusContacted,
  interested: styles.statusInterested,
  applied: styles.statusApplied,
  enrolled: styles.statusEnrolled,
  lost: styles.statusLost,
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`${styles.badge} ${STATUS_CLASS[status]}`}>{LEAD_STATUS_LABELS[status]}</span>;
}

const TEMPERATURE_CLASS = {
  Hot: styles.tempHot,
  Warm: styles.tempWarm,
  Cold: styles.tempCold,
};

export function TemperatureBadge({ temperature }: { temperature: string }) {
  const normalized = normalizeLeadTemperature(temperature);
  if (!normalized) return <span className={styles.muted}>—</span>;
  return <span className={`${styles.badge} ${TEMPERATURE_CLASS[normalized]}`}>{normalized}</span>;
}
