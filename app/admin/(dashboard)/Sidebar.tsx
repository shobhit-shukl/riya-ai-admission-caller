"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

const NAV_ITEMS = [
  { href: "/admin/analytics", label: "Analytics", icon: <AnalyticsIcon /> },
  { href: "/admin/leads", label: "Leads", icon: <LeadsIcon /> },
  { href: "/admin/website-leads", label: "Website leads", icon: <WebsiteLeadsIcon /> },
  { href: "/admin/contacts", label: "Call list", icon: <CallListIcon /> },
  { href: "/admin/courses", label: "Courses", icon: <CoursesIcon /> },
  { href: "/admin/calling-setup", label: "Calling setup", icon: <SetupIcon /> },
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

function WebsiteLeadsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.9 8ZM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96ZM4.26 14a8.2 8.2 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26Zm.84 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.1 16Zm2.95-8H5.1a7.99 7.99 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.05 8ZM12 19.96A14.1 14.1 0 0 1 10.09 16h3.82A14.1 14.1 0 0 1 12 19.96ZM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4Zm.25 5.56A15.7 15.7 0 0 0 15.95 16h2.95a8.03 8.03 0 0 1-4.31 3.56ZM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.2 8.2 0 0 1 0 4h-3.38Z" />
    </svg>
  );
}

function SetupIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.4l-.4 2.7a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.7c0 .2.3.4.5.4h4c.2 0 .5-.2.5-.4l.4-2.7c.6-.3 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
    </svg>
  );
}

function CoursesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3ZM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82Z" />
    </svg>
  );
}

function CallListIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z" />
    </svg>
  );
}
