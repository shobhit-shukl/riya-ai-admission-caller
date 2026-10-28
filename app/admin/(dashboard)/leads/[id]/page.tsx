import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findLeadIdForCall, getLeadById } from "@/lib/leads";
import dashboardStyles from "../../dashboard.module.css";
import LeadDetail from "../LeadDetail";
import styles from "../leads.module.css";

export const metadata = {
  title: "Lead detail — Sam Admin",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadById(id);

  if (!lead) {
    // Links from before leads were grouped per caller use the call's id.
    const leadId = await findLeadIdForCall(id);
    if (leadId) redirect(`/admin/leads/${leadId}`);
    notFound();
  }

  return (
    <div>
      <div className={dashboardStyles.pageHeading}>
        <Link href="/admin/leads" className={styles.backLink}>
          ← Back to leads
        </Link>
      </div>

      <div className={styles.standaloneDetail}>
        <LeadDetail lead={lead} />
      </div>
    </div>
  );
}
