import Link from "next/link";
import {
  countWebsiteLeads,
  getWebsiteLeadsPage,
  type WebsiteLeadFilters,
  type WebsiteLeadListItem,
} from "@/lib/websiteLeads";
import {
  WEBSITE_FORM_LABELS,
  WEBSITE_FORM_TYPES,
  WEBSITE_LEAD_STATUSES,
  WEBSITE_LEAD_STATUS_LABELS,
  type WebsiteFormType,
  type WebsiteLeadStatus,
} from "@/lib/websiteLeadTypes";
import { isOutboundCallingConfigured, toE164 } from "@/lib/outboundCalls";
import { formatInAppTimeZone } from "@/lib/time";
import dashboardStyles from "../dashboard.module.css";
import leadStyles from "../leads/leads.module.css";
import { CallButton, StatusSelect } from "./WebsiteLeadRowActions";
import styles from "./website-leads.module.css";

export const metadata = {
  title: "Website leads — Riya Admin",
};

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function parseFilters(params: Params): WebsiteLeadFilters {
  const status = first(params.status);
  const formType = first(params.form);
  return {
    q: first(params.q).slice(0, 100),
    status: (WEBSITE_LEAD_STATUSES as readonly string[]).includes(status) ? (status as WebsiteLeadStatus) : "",
    formType: (WEBSITE_FORM_TYPES as readonly string[]).includes(formType) ? (formType as WebsiteFormType) : "",
    course: first(params.course).slice(0, 100),
  };
}

function buildHref(filters: WebsiteLeadFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.formType) params.set("form", filters.formType);
  if (filters.course) params.set("course", filters.course);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/website-leads?${query}` : "/admin/website-leads";
}

function formatWhen(iso: string): string {
  return formatInAppTimeZone(iso, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function callDisabledReason(lead: WebsiteLeadListItem, configured: boolean): string | null {
  if (!configured) return "Calling isn't set up yet.";
  if (!toE164(lead.phone)) return "Not a callable number.";
  return null;
}

export default async function WebsiteLeadsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const requestedPage = Number(first(params.page) || "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const isFiltered = Boolean(filters.q || filters.status || filters.formType || filters.course);

  const configured = isOutboundCallingConfigured();
  const [{ leads, totalCount, totalPages, currentPage }, counts] = await Promise.all([
    getWebsiteLeadsPage(filters, page),
    countWebsiteLeads(),
  ]);

  return (
    <div>
      <div className={dashboardStyles.pageHeading}>
        <h1>Website leads</h1>
        <p>
          Enquiries from the university website and the WhatsApp bot. {counts.total} total · {counts.new} new · {counts.today} today
        </p>
      </div>

      <form method="get" action="/admin/website-leads" className={leadStyles.filterBar}>
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search name, phone or email"
          className={`${leadStyles.input} ${leadStyles.filterSearch}`}
          aria-label="Search name, phone or email"
        />
        <select name="status" defaultValue={filters.status} className={leadStyles.input} aria-label="Status">
          <option value="">All statuses</option>
          {WEBSITE_LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {WEBSITE_LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <select name="form" defaultValue={filters.formType} className={leadStyles.input} aria-label="Form">
          <option value="">All forms</option>
          {WEBSITE_FORM_TYPES.map((value) => (
            <option key={value} value={value}>
              {WEBSITE_FORM_LABELS[value]}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="course"
          defaultValue={filters.course}
          placeholder="Course"
          className={leadStyles.input}
          aria-label="Course"
        />
        <button type="submit" className={leadStyles.primaryButton}>
          Apply
        </button>
        {isFiltered && (
          <Link href="/admin/website-leads" className={leadStyles.clearLink}>
            Clear
          </Link>
        )}
      </form>

      {leads.length === 0 ? (
        <p className={leadStyles.emptyState}>
          {isFiltered
            ? "No enquiries match these filters."
            : "No website enquiries yet. They'll appear here as soon as the university website sends them."}
        </p>
      ) : (
        <>
          <div className={leadStyles.tableWrapper}>
            <table className={leadStyles.table}>
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Student</th>
                  <th>Phone</th>
                  <th>Course</th>
                  <th>Form</th>
                  <th>Status</th>
                  <th>Lead</th>
                  <th aria-label="Call" />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{formatWhen(lead.submittedAt)}</td>
                    <td className={styles.studentCell}>
                      <span className={leadStyles.rowLink}>{lead.name || "—"}</span>
                      {lead.enquiryCount > 1 && (
                        <span className={styles.repeatBadge} title="Enquiries from this number">
                          ×{lead.enquiryCount}
                        </span>
                      )}
                      {lead.wantsCallback && (
                        <span className={styles.callbackBadge} title="Asked on WhatsApp for a counsellor to contact them">
                          🙋 Wants a call
                        </span>
                      )}
                      <details className={styles.details}>
                        <summary>Details</summary>
                        <dl className={styles.detailList}>
                          {lead.email && (
                            <>
                              <dt>Email</dt>
                              <dd>
                                <a href={`mailto:${lead.email}`}>{lead.email}</a>
                              </dd>
                            </>
                          )}
                          {lead.city && (
                            <>
                              <dt>City</dt>
                              <dd>{lead.city}</dd>
                            </>
                          )}
                          {lead.message && (
                            <>
                              <dt>Message</dt>
                              <dd className={styles.message}>{lead.message}</dd>
                            </>
                          )}
                          {lead.sourcePage && (
                            <>
                              <dt>Page</dt>
                              <dd>{lead.sourcePage}</dd>
                            </>
                          )}
                          {(lead.utmSource || lead.utmCampaign) && (
                            <>
                              <dt>Campaign</dt>
                              <dd>{[lead.utmSource, lead.utmCampaign].filter(Boolean).join(" / ")}</dd>
                            </>
                          )}
                          {lead.lastCalledAt && (
                            <>
                              <dt>Last call</dt>
                              <dd>
                                {formatWhen(lead.lastCalledAt)} ({lead.callAttempts} attempt
                                {lead.callAttempts === 1 ? "" : "s"})
                                {lead.lastCallError && <span className={leadStyles.callNowError}> {lead.lastCallError}</span>}
                              </dd>
                            </>
                          )}
                        </dl>
                      </details>
                    </td>
                    <td>{lead.phone}</td>
                    <td>{lead.course || "—"}</td>
                    <td>{WEBSITE_FORM_LABELS[lead.formType]}</td>
                    <td>
                      <StatusSelect id={lead.id} status={lead.status} />
                    </td>
                    <td>
                      {lead.leadId ? (
                        <Link href={`/admin/leads/${lead.leadId}`} className={leadStyles.backLink}>
                          View lead →
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <CallButton id={lead.id} disabledReason={callDisabledReason(lead, configured)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={leadStyles.pagination}>
            <Link
              href={buildHref(filters, currentPage - 1)}
              aria-disabled={currentPage <= 1}
              className={
                currentPage <= 1 ? `${leadStyles.pageLink} ${leadStyles.pageLinkDisabled}` : leadStyles.pageLink
              }
            >
              ← Previous
            </Link>
            <span className={leadStyles.pageStatus}>
              Page {currentPage} of {totalPages} · {totalCount} shown
            </span>
            <Link
              href={buildHref(filters, currentPage + 1)}
              aria-disabled={currentPage >= totalPages}
              className={
                currentPage >= totalPages
                  ? `${leadStyles.pageLink} ${leadStyles.pageLinkDisabled}`
                  : leadStyles.pageLink
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
