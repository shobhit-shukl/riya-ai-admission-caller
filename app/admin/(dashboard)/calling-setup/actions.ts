"use server";

/**
 * Server Action for the Calling setup page: rings the admin's own phone so
 * they can hear Sam and see the call arrive under Leads. Checks the admin
 * session itself, since Server Actions can be invoked by direct POST.
 */

import { getAdminSession } from "@/lib/auth";
import { startOutboundCall, toE164 } from "@/lib/outboundCalls";

export interface TestCallState {
  ok: boolean;
  message: string;
}

export async function testCallAction(_previous: TestCallState | null, formData: FormData): Promise<TestCallState> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");

  const phone = String(formData.get("phone") ?? "").trim().slice(0, 20);
  if (!toE164(phone)) {
    return { ok: false, message: "Enter a 10-digit mobile number, or the full number with + and country code." };
  }

  const result = await startOutboundCall({ id: "test", callerName: "", callerNumber: phone, interestedCourse: "" }, "test");

  return result.ok
    ? {
        ok: true,
        message: "Calling. Your phone should ring within a few seconds, and the call shows up under Leads about a minute after you hang up.",
      }
    : { ok: false, message: result.error };
}
