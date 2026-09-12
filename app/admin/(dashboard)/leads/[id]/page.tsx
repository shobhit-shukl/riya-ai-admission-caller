import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadById } from "@/lib/leads";
import dashboardStyles from "../../dashboard.module.css";
import LeadDetail from "../LeadDetail";
import styles from "../leads.module.css";

export const metadata = {
  title: "Lead detail — Riya Admin",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadById(id);

  if (!lead) {
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
