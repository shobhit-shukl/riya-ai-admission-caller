/**
 * models/WebsiteLead.ts
 *
 * An enquiry submitted on the university website (enquiry, apply,
 * request-a-callback or brochure forms). The website's backend forwards
 * each submission to POST /api/website-leads; they're listed under
 * Admin → Website leads, where counselors track them and can have the
 * assistant call the student.
 *
 * `externalId` is the website's own id for the submission, so a retried
 * forward doesn't create a duplicate.
 */

import { Schema, model, models } from "mongoose";
import { WEBSITE_FORM_TYPES, WEBSITE_LEAD_STATUSES } from "@/lib/websiteLeadTypes";

const WebsiteLeadSchema = new Schema(
  {
    externalId: { type: String },
    name: { type: String, default: "" },
    phone: { type: String, required: true },
    phoneKey: { type: String, required: true, index: true },
    email: { type: String, default: "" },
    course: { type: String, default: "" },
    city: { type: String, default: "" },
    message: { type: String, default: "" },
    formType: { type: String, enum: WEBSITE_FORM_TYPES, default: "enquiry" },
    sourcePage: { type: String, default: "" },
    utmSource: { type: String, default: "" },
    utmMedium: { type: String, default: "" },
    utmCampaign: { type: String, default: "" },
    submittedAt: { type: Date, required: true, index: true },
    // WhatsApp chats: the student asked for a counsellor to contact them.
    wantsCallback: { type: Boolean, default: false },

    status: { type: String, enum: WEBSITE_LEAD_STATUSES, default: "new", index: true },
    callAttempts: { type: Number, default: 0 },
    lastCalledAt: { type: Date, default: null },
    lastCallError: { type: String, default: "" },
  },
  { timestamps: true }
);

WebsiteLeadSchema.index(
  { externalId: 1 },
  { name: "externalId_unique", unique: true, partialFilterExpression: { externalId: { $type: "string" } } }
);

export default models.WebsiteLead || model("WebsiteLead", WebsiteLeadSchema);
