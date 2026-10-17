/**
 * models/Lead.ts
 *
 * One document per prospective student, as the admissions team tracks them.
 * Every call from the same phone number (matched by `phoneKey`) is folded
 * into the same Lead, so a repeat caller isn't a new lead each time. Calls
 * without a usable number (e.g. web calls) each get a Lead of their own.
 *
 * The details fields (name, course, marks…) hold the latest non-empty value
 * seen across that caller's calls; the per-call data stays on CallRecord.
 */

import { Schema, model, models } from "mongoose";
import { LEAD_STATUSES } from "@/lib/leadPipeline";

const LeadNoteSchema = new Schema(
  {
    text: { type: String, required: true },
    author: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const LeadSchema = new Schema(
  {
    phoneKey: { type: String },
    callerNumber: { type: String, default: "" },
    callerName: { type: String, default: "" },
    interestedCourse: { type: String, default: "" },
    academicMarks: { type: String, default: "" },
    hostelRequired: { type: String, default: "" },
    location: { type: String, default: "" },
    nextAction: { type: String, default: "" },
    callerRole: { type: String, default: "" },
    leadTemperature: { type: String, default: "" },
    preferredCallbackTime: { type: String, default: "" },
    summary: { type: String, default: "" },

    status: { type: String, enum: LEAD_STATUSES, default: "new", index: true },
    followUpAt: { type: Date, default: null, index: true },
    notes: { type: [LeadNoteSchema], default: [] },

    callCount: { type: Number, default: 0 },
    firstCallAt: { type: Date },
    lastCallAt: { type: Date, index: true },

    // Outbound callbacks (lib/outboundCalls.ts, lib/callbacks.ts).
    // Attempts count towards the current follow-up date and reset when it changes.
    doNotCall: { type: Boolean, default: false },
    callbackAttempts: { type: Number, default: 0 },
    lastCallbackAt: { type: Date, default: null },
    lastCallbackError: { type: String, default: "" },
  },
  { timestamps: true }
);

// One Lead per phone number. Partial so the many leads without a usable
// number (web calls) don't collide on a missing key.
LeadSchema.index(
  { phoneKey: 1 },
  { name: "phoneKey_unique", unique: true, partialFilterExpression: { phoneKey: { $type: "string" } } }
);

export default models.Lead || model("Lead", LeadSchema);
