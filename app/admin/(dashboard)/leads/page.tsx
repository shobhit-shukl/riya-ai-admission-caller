import Link from "next/link";
import { getLeadsPage } from "@/lib/leads";
import dashboardStyles from "../dashboard.module.css";
import styles from "./leads.module.css";
import LeadsTable from "./LeadsTable";

export const metadata = {
  title: "Leads — Riya Admin",
};

function buildPageHref(page: number): string {
  return page <= 1 ? "/admin/leads" : `/admin/leads?page=${page}`;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedPage = Number(resolvedSearchParams.page ?? "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  const { leads, totalCount, totalPages, currentPage } = await getLeadsPage(page);

  return (
    <div>
      <div className={dashboardStyles.pageHeading}>
        <h1>Leads</h1>
        <p>
          {totalCount} lead{totalCount === 1 ? "" : "s"} logged in total.
        </p>
      </div>

      {leads.length === 0 ? (
        <p className={styles.emptyState}>No leads have been logged yet.</p>
      ) : (
        <>
          <LeadsTable leads={leads} />

          <div className={styles.pagination}>
            <Link
              href={buildPageHref(currentPage - 1)}
              aria-disabled={currentPage <= 1}
              className={currentPage <= 1 ? `${styles.pageLink} ${styles.pageLinkDisabled}` : styles.pageLink}
            >
              ← Previous
            </Link>

            <span className={styles.pageStatus}>
              Page {currentPage} of {totalPages}
            </span>

            <Link
              href={buildPageHref(currentPage + 1)}
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
