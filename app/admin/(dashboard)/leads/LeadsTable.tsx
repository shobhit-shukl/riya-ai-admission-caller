"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LeadDetail as LeadDetailData } from "@/lib/leads";
import LeadDetail from "./LeadDetail";
import styles from "./leads.module.css";

function formatShortDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LeadsTable({ leads }: { leads: LeadDetailData[] }) {
  const [selectedLead, setSelectedLead] = useState<LeadDetailData | null>(null);

  useEffect(() => {
    if (!selectedLead) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedLead(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedLead]);

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Caller</th>
              <th>Phone</th>
              <th>Course</th>
              <th>Hostel</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className={styles.row} onClick={() => setSelectedLead(lead)}>
                <td>{formatShortDate(lead.timestamp)}</td>
                <td>{lead.callerName || "Unknown"}</td>
                <td>{lead.callerNumber || "—"}</td>
                <td>{lead.interestedCourse || "—"}</td>
                <td>{lead.hostelRequired || "—"}</td>
                <td>{lead.location || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedLead && (
        <div className={styles.modalOverlay} onClick={() => setSelectedLead(null)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalToolbar}>
              <Link href={`/admin/leads/${selectedLead.id}`} className={styles.modalFullPageLink}>
                Open full page ↗
              </Link>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setSelectedLead(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <LeadDetail lead={selectedLead} />
          </div>
        </div>
      )}
    </>
  );
}
