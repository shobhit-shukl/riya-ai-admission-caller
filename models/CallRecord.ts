/**
 * models/CallRecord.ts
 *
 * Mongoose schema mirroring the Google Sheet columns (A-J) in
 * lib/googleSheets.ts, plus a few extra Vapi call-metadata fields that
 * don't have a column in the sheet but are useful to keep for lookups
 * and debugging (callId, endedReason, startedAt, endedAt, cost, and the
 * raw analysis object returned by Vapi).
 */

import { Schema, model, models } from "mongoose";

const CallRecordSchema = new Schema(
  {
    callId: { type: String, index: true },
    timestamp: { type: Date, required: true },
    callerName: { type: String, default: "" },
    callerNumber: { type: String, default: "", index: true },
    interestedCourse: { type: String, default: "" },
    summary: { type: String, default: "" },
    transcript: { type: String, default: "" },
    academicMarks: { type: String, default: "" },
    hostelRequired: { type: String, default: "" },
    location: { type: String, default: "" },
    nextAction: { type: String, default: "" },
    endedReason: { type: String, default: "" },
    startedAt: { type: Date },
    endedAt: { type: Date },
    cost: { type: Number },
    rawAnalysis: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Reuse the compiled model across hot reloads / serverless invocations
// instead of calling `model()` again, which would throw
// "Cannot overwrite `CallRecord` model once compiled".
export default models.CallRecord || model("CallRecord", CallRecordSchema);
