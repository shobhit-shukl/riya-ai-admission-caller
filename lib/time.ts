/**
 * lib/time.ts
 *
 * The server (e.g. Vercel) runs in UTC, but admissions staff read the
 * dashboard in IST. All "today" boundaries, day buckets and displayed
 * timestamps go through these helpers so they agree with each other —
 * and so server-rendered and client-rendered dates don't mismatch.
 */

export const APP_TIME_ZONE = "Asia/Kolkata";

/** Formats an ISO timestamp in the app's time zone. Returns "—" for blank input. */
export function formatInAppTimeZone(iso: string, options: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IN", { ...options, timeZone: APP_TIME_ZONE });
}

/** "YYYY-MM-DD" for the calendar day `date` falls on in the app's time zone. */
export function appDayKey(date: Date): string {
  // en-CA formats dates as YYYY-MM-DD.
  return date.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
}

/**
 * The instant at which the app-time-zone day that is `daysAgo` days before
 * today began. IST has no DST, so the offset is derived once from `now`.
 */
export function startOfAppDay(daysAgo = 0, now = new Date()): Date {
  const [year, month, day] = appDayKey(now).split("-").map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day - daysAgo);

  // Offset of the app time zone from UTC at `now`, in ms (e.g. +5:30 for IST).
  const zoned = new Date(now.toLocaleString("en-US", { timeZone: APP_TIME_ZONE }));
  const asUtc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = zoned.getTime() - asUtc.getTime();

  return new Date(utcMidnight - offsetMs);
}
