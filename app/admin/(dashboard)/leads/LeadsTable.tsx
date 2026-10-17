"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LeadListItem } from "@/lib/leads";
import { formatInAppTimeZone } from "@/lib/time";
import { StatusBadge, TemperatureBadge } from "./LeadBadges";
import styles from "./leads.module.css";

function formatShortDate(iso: string): string {
  return formatInAppTimeZone(iso, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFollowUp(iso: string | null): string {
  return iso ? formatInAppTimeZone(iso, { month: "short", day: "numeric" }) : "—";
}

export default function LeadsTable({ leads, dueBefore }: { leads: LeadListItem[]; dueBefore: string }) {
  const router = useRouter();

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Last call</th>
            <th>Caller</th>
            <th>Phone</th>
            <th>Course</th>
            <th>Temp</th>
            <th>Status</th>
            <th>Follow-up</th>
            <th>Calls</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const href = `/admin/leads/${lead.id}`;
            const isDue = lead.followUpAt !== null && lead.followUpAt < dueBefore;

            return (
              <tr key={lead.id} className={styles.row} onClick={() => router.push(href)}>
                <td>{formatShortDate(lead.lastCallAt)}</td>
                <td>
                  <Link href={href} className={styles.rowLink} onClick={(event) => event.stopPropagation()}>
                    {lead.callerName || "Unknown"}
                  </Link>
                </td>
                <td>{lead.callerNumber || "—"}</td>
                <td>{lead.interestedCourse || "—"}</td>
                <td>
                  <TemperatureBadge temperature={lead.leadTemperature} />
                </td>
                <td>
                  <StatusBadge status={lead.status} />
                </td>
                <td className={isDue ? styles.followUpDue : undefined}>{formatFollowUp(lead.followUpAt)}</td>
                <td className={styles.numeric}>{lead.callCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
