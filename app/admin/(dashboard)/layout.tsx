import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_SESSION_COOKIE } from "@/lib/auth";
import Sidebar from "./Sidebar";
import styles from "./dashboard.module.css";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

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
