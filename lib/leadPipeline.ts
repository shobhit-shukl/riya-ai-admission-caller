/**
 * lib/leadPipeline.ts
 *
 * Plain constants and helpers for the lead pipeline, shared by server code
 * and client components (so nothing here may import Mongoose).
 */

export const LEAD_STATUSES = ["new", "contacted", "interested", "applied", "enrolled", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  applied: "Applied",
  enrolled: "Enrolled",
  lost: "Lost",
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

export const LEAD_TEMPERATURES = ["Hot", "Warm", "Cold"] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

/** Maps whatever the extractor returned ("hot", " HOT ") onto Hot/Warm/Cold, or "" if unrecognised. */
export function normalizeLeadTemperature(value: string | undefined): LeadTemperature | "" {
  const match = LEAD_TEMPERATURES.find((t) => t.toLowerCase() === value?.trim().toLowerCase());
  return match ?? "";
}

/**
 * Reduces a phone number to a key that matches the same caller across calls:
 * the last 10 digits, so "+91 98765 43210", "09876543210" and "9876543210"
 * all become "9876543210". Returns null when there aren't enough digits to
 * be a real number (web calls arrive as "Unknown").
 */
export function phoneKey(phone: string | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}
