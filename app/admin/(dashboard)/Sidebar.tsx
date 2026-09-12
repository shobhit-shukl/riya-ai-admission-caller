"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

const NAV_ITEMS = [
  { href: "/admin/analytics", label: "Analytics", icon: <AnalyticsIcon /> },
  { href: "/admin/leads", label: "Leads", icon: <LeadsIcon /> },
];

export default function Sidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Link href="/admin/analytics" className={styles.logo}>
            <span className={styles.logoDot} />
            Riya Admin
          </Link>

          <nav className={styles.nav}>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          <div className={styles.adminEmail} title={adminEmail}>
            {adminEmail}
          </div>
          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className={styles.mobileTopBar}>
        <Link href="/admin/analytics" className={styles.logo}>
          <span className={styles.logoDot} />
          Riya Admin
        </Link>

        <nav className={styles.mobileNav}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive ? `${styles.mobileNavLink} ${styles.mobileNavLinkActive}` : styles.mobileNavLink
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

function AnalyticsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M4 20V10h3v10H4Zm6.5 0V4h3v16h-3ZM17 20v-7h3v7h-3Z" />
    </svg>
  );
}

function LeadsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-3.6 0-8 1.8-8 4.5V21h16v-2.5c0-2.7-4.4-4.5-8-4.5Z" />
    </svg>
  );
}
