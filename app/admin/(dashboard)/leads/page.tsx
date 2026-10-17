import Link from "next/link";
import {
  countDueFollowUps,
  getLeadsPage,
  leadFiltersToQuery,
  parseLeadFilters,
  type LeadFilters,
} from "@/lib/leads";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_TEMPERATURES } from "@/lib/leadPipeline";
import { startOfAppDay } from "@/lib/time";
import dashboardStyles from "../dashboard.module.css";
import styles from "./leads.module.css";
import LeadsTable from "./LeadsTable";

export const metadata = {
  title: "Leads — Riya Admin",
};

function buildPageHref(filters: LeadFilters, page: number): string {
  const query = leadFiltersToQuery(filters, page > 1 ? { page: String(page) } : {});
  return query ? `/admin/leads?${query}` : "/admin/leads";
}

function hasActiveFilters(filters: LeadFilters): boolean {
  return Object.values(filters).some(Boolean);
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters = parseLeadFilters(resolvedSearchParams);
  const requestedPage = Number(resolvedSearchParams.page ?? "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  const [{ leads, totalCount, totalPages, currentPage }, dueCount] = await Promise.all([
    getLeadsPage(filters, page),
    countDueFollowUps(),
  ]);

  const filterQuery = leadFiltersToQuery(filters);
  const exportHref = `/api/admin/leads/export${filterQuery ? `?${filterQuery}` : ""}`;
  const isFiltered = hasActiveFilters(filters);

  return (
    <div>
      <div className={`${dashboardStyles.pageHeading} ${styles.headingRow}`}>
        <div>
          <h1>Leads</h1>
          <p>
            {totalCount} lead{totalCount === 1 ? "" : "s"}
            {isFiltered ? " match these filters." : " in total."}
          </p>
        </div>
        <div className={styles.headingActions}>
          {dueCount > 0 && filters.followUp !== "due" && (
            <Link href="/admin/leads?followUp=due" className={styles.dueLink}>
              {dueCount} follow-up{dueCount === 1 ? "" : "s"} due
            </Link>
          )}
          <a href={exportHref} className={styles.secondaryButton} download>
            Export CSV
          </a>
        </div>
      </div>

      <form method="get" action="/admin/leads" className={styles.filterBar}>
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search name or phone"
          className={`${styles.input} ${styles.filterSearch}`}
          aria-label="Search name or phone"
        />
        <select name="status" defaultValue={filters.status} className={styles.input} aria-label="Status">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {LEAD_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <select
          name="temperature"
          defaultValue={filters.temperature}
          className={styles.input}
          aria-label="Lead temperature"
        >
          <option value="">Hot, warm & cold</option>
          {LEAD_TEMPERATURES.map((temperature) => (
            <option key={temperature} value={temperature}>
              {temperature}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="course"
          defaultValue={filters.course}
          placeholder="Course"
          className={styles.input}
          aria-label="Course"
        />
        <label className={styles.filterDate}>
          <span>From</span>
          <input type="date" name="from" defaultValue={filters.from} className={styles.input} />
        </label>
        <label className={styles.filterDate}>
          <span>To</span>
          <input type="date" name="to" defaultValue={filters.to} className={styles.input} />
        </label>
        <label className={styles.filterCheckbox}>
          <input type="checkbox" name="followUp" value="due" defaultChecked={filters.followUp === "due"} />
          Follow-up due
        </label>
        <button type="submit" className={styles.primaryButton}>
          Apply
        </button>
        {isFiltered && (
          <Link href="/admin/leads" className={styles.clearLink}>
            Clear
          </Link>
        )}
      </form>

      {leads.length === 0 ? (
        <p className={styles.emptyState}>
          {isFiltered ? "No leads match these filters." : "No leads have been logged yet."}
        </p>
      ) : (
        <>
          <LeadsTable leads={leads} dueBefore={startOfAppDay(-1).toISOString()} />

          <div className={styles.pagination}>
            <Link
              href={buildPageHref(filters, currentPage - 1)}
              aria-disabled={currentPage <= 1}
              className={currentPage <= 1 ? `${styles.pageLink} ${styles.pageLinkDisabled}` : styles.pageLink}
            >
              ← Previous
            </Link>

            <span className={styles.pageStatus}>
              Page {currentPage} of {totalPages}
            </span>

            <Link
              href={buildPageHref(filters, currentPage + 1)}
              aria-disabled={currentPage >= totalPages}
              className={
                currentPage >= totalPages ? `${styles.pageLink} ${styles.pageLinkDisabled}` : styles.pageLink
              }
            >
              Next →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
