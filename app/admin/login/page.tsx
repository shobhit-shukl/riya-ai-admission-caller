import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_SESSION_COOKIE } from "@/lib/auth";
import LoginForm from "./LoginForm";
import styles from "./login.module.css";

export const metadata = {
  title: "Admin Sign In — Riya",
};

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (session) {
    redirect("/admin");
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoDot} />
          Riya Admin
        </div>
        <h1>Sign in</h1>
        <p className={styles.subtitle}>Access the leads dashboard.</p>
        <LoginForm />
      </div>
    </div>
  );
}
