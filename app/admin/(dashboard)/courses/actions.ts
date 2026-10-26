"use server";

/**
 * Server Actions for Admin → Courses: add, edit and remove courses, and
 * save the institution-wide admission info. Each checks the admin session
 * itself, since Server Actions can be invoked by direct POST.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import {
  createCourse,
  deleteCourse,
  parseAdmissionInfoForm,
  parseCourseForm,
  saveAdmissionInfo,
  updateCourse,
} from "@/lib/courses";

async function requireAdmin() {
  if (!(await getAdminSession())) throw new Error("Unauthorized");
}

export interface FormState {
  ok: boolean;
  message: string;
}

export async function saveCourseAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = parseCourseForm(formData);
  if (!parsed.ok) return { ok: false, message: parsed.error };

  const id = String(formData.get("id") ?? "");
  if (id) {
    if (!(await updateCourse(id, parsed.course))) return { ok: false, message: "That course no longer exists." };
  } else {
    await createCourse(parsed.course);
  }

  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

export async function deleteCourseAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await deleteCourse(String(formData.get("id") ?? ""));
  revalidatePath("/admin/courses");
}

export async function saveAdmissionInfoAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = parseAdmissionInfoForm(formData);
  if (!parsed.ok) return { ok: false, message: parsed.error };

  await saveAdmissionInfo(parsed.info);
  revalidatePath("/admin/courses");
  return { ok: true, message: "Saved. The WhatsApp bot uses this from its next reply." };
}
