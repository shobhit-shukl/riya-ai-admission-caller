/**
 * models/Contact.ts
 *
 * A student on the admin's call list — imported from an uploaded Excel/CSV
 * file (lib/contactImport.ts) and called from the Call list page. One
 * document per phone number (`phoneKey`, last 10 digits), so uploading the
 * same number again updates it instead of duplicating it.
 *
 * Once a call ends, the webhook files it as a Lead like any other call
 * (matched by the same phoneKey), so the conversation shows up under Leads.
 */

import { Schema, model, models } from "mongoose";

export const CONTACT_STATUSES = ["new", "called", "failed"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

const ContactSchema = new Schema(
  {
    name: { type: String, default: "" },
    phone: { type: String, required: true },
    phoneKey: { type: String, required: true },
    course: { type: String, default: "" },
    /** Name of the file this contact was last imported from. */
    source: { type: String, default: "" },

    status: { type: String, enum: CONTACT_STATUSES, default: "new", index: true },
    callAttempts: { type: Number, default: 0 },
    lastCalledAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

ContactSchema.index({ phoneKey: 1 }, { name: "contact_phoneKey_unique", unique: true });
ContactSchema.index({ createdAt: -1 });

export default models.Contact || model("Contact", ContactSchema);
