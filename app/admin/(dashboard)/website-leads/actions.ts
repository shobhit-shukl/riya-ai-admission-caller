"use server";

/**
 * Server Actions for Admin → Website leads. Each checks the admin session
 * itself, since Server Actions can be invoked by direct POST.
 */

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/auth";
import { callWebsiteLead, setWebsiteLeadStatus } from "@/lib/websiteLeads";
import { WEBSITE_LEAD_STATUSES, type WebsiteLeadStatus } from "@/lib/websiteLeadTypes";

async function requireAdmin() {
  if (!(await getAdminSession())) throw new Error("Unauthorized");
}

export async function updateWebsiteLeadStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const status = String(formData.get("status") ?? "");
  if (!(WEBSITE_LEAD_STATUSES as readonly string[]).includes(status)) return;

  await setWebsiteLeadStatus(String(formData.get("id") ?? ""), status as WebsiteLeadStatus);
  revalidatePath("/admin/website-leads");
}

export interface CallWebsiteLeadState {
  ok: boolean;
  message: string;
}

export async function callWebsiteLeadAction(
  _previous: CallWebsiteLeadState | null,
  formData: FormData
): Promise<CallWebsiteLeadState> {
  await requireAdmin();

  const result = await callWebsiteLead(String(formData.get("id") ?? ""));
  revalidatePath("/admin/website-leads");

  return result.ok ? { ok: true, message: "Calling…" } : { ok: false, message: result.error };
}
