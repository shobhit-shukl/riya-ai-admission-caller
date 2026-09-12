import type { CSSProperties } from "react";
import Link from "next/link";
import { getLeadsAnalytics } from "@/lib/leads";
import dashboardStyles from "../dashboard.module.css";
import styles from "./analytics.module.css";

export const metadata = {
  title: "Analytics — Riya Admin",
};

function formatCompact(value: number): string {
  return Intl.NumberFormat(undefined, { notation: "compact" }).format(value);
}

function TotalLeadsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-3.6 0-8 1.8-8 4.5V21h16v-2.5c0-2.7-4.4-4.5-8-4.5Z" />
    </svg>
  );
}

function TodayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7ZM5 9h14v10H5V9Z" />
    </svg>
  );
}

function HostelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 3 2 10h3v10h5v-6h4v6h5V10h3L12 3Z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
    </svg>
  );
}

function BarList({ data, emptyLabel }: { data: { label: string; count: number }[]; emptyLabel: string }) {
  if (data.length === 0) {
    return <p className={styles.emptyState}>{emptyLabel}</p>;
  }

  const max = Math.max(...data.map((entry) => entry.count), 1);

  return (
    <div className={styles.barList}>
      {data.map((entry) => (
        <div className={styles.barRow} key={entry.label}>
          <span className={styles.barLabel} title={entry.label}>
            {entry.label}
          </span>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ "--bar-width": `${(entry.count / max) * 100}%` } as CSSProperties}
            />
          </div>
          <span className={styles.barValue}>{entry.count}</span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map((entry) => entry.count), 1);

  return (
    <div className={styles.trend}>
      {data.map((entry, index) => (
        <div className={styles.trendColumn} key={`${entry.label}-${index}`}>
          <span className={styles.trendValue}>{entry.count}</span>
          <div className={styles.trendTrack}>
            <div
              className={styles.trendFill}
              style={
                {
                  "--trend-height": `${Math.max((entry.count / max) * 100, entry.count > 0 ? 6 : 0)}%`,
                } as CSSProperties
              }
              title={`${entry.label}: ${entry.count} lead${entry.count === 1 ? "" : "s"}`}
            />
          </div>
          <span className={styles.trendLabel}>{entry.label}</span>
        </div>
      ))}
    </div>
  );
}

export default async function AnalyticsPage() {
  const analytics = await getLeadsAnalytics();

  return (
    <div>
      <div className={dashboardStyles.pageHeading}>
        <h1>Analytics</h1>
        <p>An overview of every lead Riya has logged.</p>
      </div>

      <div className={styles.statGrid}>
        <div className={styles.statTile}>
          <div className={`${styles.statIcon} ${styles.statIconIndigo}`}>
            <TotalLeadsIcon />
          </div>
          <div>
            <span className={styles.statLabel}>Total leads</span>
            <span className={styles.statValue}>{formatCompact(analytics.totalLeads)}</span>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={`${styles.statIcon} ${styles.statIconTeal}`}>
            <TodayIcon />
          </div>
          <div>
            <span className={styles.statLabel}>Leads today</span>
            <span className={styles.statValue}>{formatCompact(analytics.leadsToday)}</span>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={`${styles.statIcon} ${styles.statIconAmber}`}>
            <HostelIcon />
          </div>
          <div>
            <span className={styles.statLabel}>Need hostel</span>
            <span className={styles.statValue}>{formatCompact(analytics.hostelYesCount)}</span>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={`${styles.statIcon} ${styles.statIconRose}`}>
            <LocationIcon />
          </div>
          <div>
            <span className={styles.statLabel}>Locations reached</span>
            <span className={styles.statValue}>{formatCompact(analytics.distinctLocationCount)}</span>
          </div>
        </div>
      </div>

      <div className={styles.panelGrid}>
        <section className={styles.panel}>
          <h2>Leads in the last 7 days</h2>
          <TrendChart data={analytics.dailyTrend} />
        </section>

        <section className={styles.panel}>
          <h2>Top interested courses</h2>
          <BarList data={analytics.topCourses} emptyLabel="No course data yet." />
        </section>

        <section className={styles.panel}>
          <h2>Hostel requirement</h2>
          <BarList data={analytics.hostelBreakdown} emptyLabel="No data yet." />
        </section>

        <section className={styles.panel}>
          <h2>Top locations</h2>
          <BarList data={analytics.topLocations} emptyLabel="No location data yet." />
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.recentHeader}>
          <h2>Recent leads</h2>
          <Link href="/admin/leads" className={styles.viewAllLink}>
            View all leads →
          </Link>
        </div>

        {analytics.recentLeads.length === 0 ? (
          <p className={styles.emptyState}>No leads logged yet.</p>
        ) : (
          <div className={styles.recentList}>
            {analytics.recentLeads.map((lead) => (
              <Link href={`/admin/leads/${lead.id}`} className={styles.recentRow} key={lead.id}>
                <div>
                  <span className={styles.recentName}>{lead.callerName || "Unknown caller"}</span>
                  <span className={styles.recentMeta}>
                    {lead.callerNumber} · {lead.interestedCourse || "No course captured"}
                  </span>
                </div>
                <span className={styles.recentDate}>
                  {new Date(lead.timestamp).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
