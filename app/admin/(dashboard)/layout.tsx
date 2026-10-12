import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import Sidebar from "./Sidebar";
import styles from "./dashboard.module.css";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className={styles.shell}>
      <Sidebar adminEmail={session.email} />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
