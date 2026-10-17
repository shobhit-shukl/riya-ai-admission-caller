"use server";

/**
 * Server Actions for the call list: import contacts from an uploaded file,
 * call one, or remove one. Each checks the admin session itself, since
 * Server Actions can be invoked by direct POST.
 */

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/auth";
import { importContactsFile, type ImportSummary } from "@/lib/contactImport";
import { callContact } from "@/lib/contacts";
import { connectToDatabase } from "@/lib/mongodb";
import ContactModel from "@/models/Contact";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export type UploadState = { ok: true; summary: ImportSummary } | { ok: false; message: string };

export async function uploadContactsAction(_previous: UploadState | null, formData: FormData): Promise<UploadState> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an .xlsx or .csv file first." };
  }

  try {
    const summary = await importContactsFile(file);
    revalidatePath("/admin/contacts");
    return { ok: true, summary };
  } catch (error: unknown) {
    return { ok: false, message: error instanceof Error ? error.message : "Upload failed." };
  }
}

export interface CallContactState {
  ok: boolean;
  message: string;
}

export async function callContactAction(
  _previous: CallContactState | null,
  formData: FormData
): Promise<CallContactState> {
  await requireAdmin();

  const result = await callContact(String(formData.get("contactId") ?? ""));
  revalidatePath("/admin/contacts");

  return result.ok ? { ok: true, message: "Calling…" } : { ok: false, message: result.error };
}

export async function removeContactAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("contactId") ?? "");
  if (!isValidObjectId(id)) return;

  await connectToDatabase();
  await ContactModel.deleteOne({ _id: id });
  revalidatePath("/admin/contacts");
}
