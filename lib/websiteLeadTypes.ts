/**
 * lib/websiteLeadTypes.ts
 *
 * Constants for website enquiries, shared by the model, server code and
 * client components (so nothing here may import Mongoose).
 */

export const WEBSITE_LEAD_STATUSES = ["new", "contacted", "converted", "closed"] as const;
export type WebsiteLeadStatus = (typeof WEBSITE_LEAD_STATUSES)[number];

export const WEBSITE_LEAD_STATUS_LABELS: Record<WebsiteLeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  closed: "Closed",
};

// "whatsapp" is set by the WhatsApp bot (POST /api/bot/leads), not by website forms.
export const WEBSITE_FORM_TYPES = ["enquiry", "apply", "callback", "brochure", "contact", "whatsapp"] as const;
export type WebsiteFormType = (typeof WEBSITE_FORM_TYPES)[number];

export const WEBSITE_FORM_LABELS: Record<WebsiteFormType, string> = {
  enquiry: "Enquiry",
  apply: "Apply",
  callback: "Callback request",
  brochure: "Brochure",
  contact: "Contact",
  whatsapp: "WhatsApp",
};
