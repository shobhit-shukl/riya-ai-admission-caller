import Link from "next/link";
import { countContactsByStatus, getContactsPage, type ContactListItem } from "@/lib/contacts";
import { isOutboundCallingConfigured, toE164 } from "@/lib/outboundCalls";
import { formatInAppTimeZone } from "@/lib/time";
import { CONTACT_STATUSES, type ContactStatus } from "@/models/Contact";
import dashboardStyles from "../dashboard.module.css";
import leadStyles from "../leads/leads.module.css";
import ContactRowActions from "./ContactRowActions";
import styles from "./contacts.module.css";
import UploadContactsForm from "./UploadContactsForm";

export const metadata = {
  title: "Call list — Riya Admin",
};

const STATUS_LABELS: Record<ContactStatus, string> = {
  new: "Not called",
  called: "Called",
  failed: "Failed",
};

const STATUS_CLASS: Record<ContactStatus, string> = {
  new: leadStyles.statusNew,
  called: leadStyles.statusEnrolled,
  failed: leadStyles.tempHot,
};

function buildHref(search: string, status: string, page: number): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/contacts?${query}` : "/admin/contacts";
}

function callDisabledReason(contact: ContactListItem, configured: boolean): string | null {
  if (!configured) return "Calling isn't set up yet.";
  if (!toE164(contact.phone)) return "Not a callable number.";
  return null;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const search = first(params.q).slice(0, 100);
  const statusParam = first(params.status);
  const status = (CONTACT_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as ContactStatus) : "";
  const requestedPage = Number(first(params.page) || "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  const configured = isOutboundCallingConfigured();
  const [{ contacts, totalCount, totalPages, currentPage }, counts] = await Promise.all([
    getContactsPage(search, status, page),
    countContactsByStatus(),
  ]);

  return (
    <div>
      <div className={dashboardStyles.pageHeading}>
        <h1>Call list</h1>
        <p>
          Upload students&apos; names and numbers, then have Sam call them. {counts.total} contact
          {counts.total === 1 ? "" : "s"} · {counts.new} not called · {counts.called} called
          {counts.failed > 0 ? ` · ${counts.failed} failed` : ""}
        </p>
      </div>

      {!configured && (
        <p className={styles.notice}>
          📵 Calling isn&apos;t set up yet, so the Call buttons are disabled. You can upload and organise your list
          now; calls start working once a phone number is connected (see README → Outbound callbacks).
        </p>
      )}

      <UploadContactsForm />

      <form method="get" action="/admin/contacts" className={leadStyles.filterBar}>
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search name or phone"
          className={`${leadStyles.input} ${leadStyles.filterSearch}`}
          aria-label="Search name or phone"
        />
        <select name="status" defaultValue={status} className={leadStyles.input} aria-label="Call status">
          <option value="">All</option>
          {CONTACT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <button type="submit" className={leadStyles.primaryButton}>
          Apply
        </button>
        {(search || status) && (
          <Link href="/admin/contacts" className={leadStyles.clearLink}>
            Clear
          </Link>
        )}
      </form>

      {contacts.length === 0 ? (
        <p className={leadStyles.emptyState}>
          {search || status ? "No contacts match these filters." : "No contacts yet. Upload a list to get started."}
        </p>
      ) : (
        <>
          <div className={leadStyles.tableWrapper}>
            <table className={leadStyles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Last called</th>
                  <th>Lead</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className={leadStyles.rowLink}>{contact.name || "—"}</td>
                    <td>{contact.phone}</td>
                    <td>{contact.course || "—"}</td>
                    <td>
                      <span
                        className={`${leadStyles.badge} ${STATUS_CLASS[contact.status]}`}
                        title={contact.lastError || undefined}
                      >
                        {STATUS_LABELS[contact.status]}
                        {contact.callAttempts > 1 ? ` ×${contact.callAttempts}` : ""}
                      </span>
                    </td>
                    <td>
                      {contact.lastCalledAt
                        ? formatInAppTimeZone(contact.lastCalledAt, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td>
                      {contact.leadId ? (
                        <Link href={`/admin/leads/${contact.leadId}`} className={leadStyles.backLink}>
                          View lead →
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <ContactRowActions
                        contactId={contact.id}
                        contactLabel={contact.name || contact.phone}
                        callDisabledReason={callDisabledReason(contact, configured)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={leadStyles.pagination}>
            <Link
              href={buildHref(search, status, currentPage - 1)}
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
              href={buildHref(search, status, currentPage + 1)}
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
