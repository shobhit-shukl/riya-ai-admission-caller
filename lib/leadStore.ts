/**
 * lib/leadStore.ts
 *
 * Folds a finished call into its Lead (models/Lead.ts): finds the caller's
 * existing Lead by phone number, or creates one, and refreshes its details
 * with whatever this call captured.
 */

import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { normalizeLeadTemperature, phoneKey } from "@/lib/leadPipeline";
import LeadModel from "@/models/Lead";

/** Per-call fields copied onto the Lead when the call captured them. */
export interface LeadCallFields {
  callerName: string;
  callerNumber: string;
  interestedCourse: string;
  academicMarks: string;
  hostelRequired: string;
  location: string;
  nextAction: string;
  callerRole: string;
  leadTemperature: string;
  preferredCallbackTime: string;
  summary: string;
}

const DETAIL_FIELDS: (keyof LeadCallFields)[] = [
  "callerName",
  "callerNumber",
  "interestedCourse",
  "academicMarks",
  "hostelRequired",
  "location",
  "nextAction",
  "callerRole",
  "leadTemperature",
  "preferredCallbackTime",
  "summary",
];

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

/**
 * Creates or updates the Lead for one call and returns its id. Only
 * non-empty values overwrite the Lead, so a short follow-up call ("just
 * checking the deadline") doesn't wipe the course or marks from the first.
 * A caller previously marked "lost" who calls again is reopened as "new".
 */
export async function upsertLeadFromCall(fields: LeadCallFields, callTime: Date): Promise<Types.ObjectId> {
  await connectToDatabase();

  const set: Record<string, string> = {};
  for (const key of DETAIL_FIELDS) {
    const value = key === "leadTemperature" ? normalizeLeadTemperature(fields[key]) : fields[key].trim();
    if (value && value !== "Unknown") set[key] = value;
  }

  const key = phoneKey(fields.callerNumber);

  if (!key) {
    const lead = await LeadModel.create({ ...set, callCount: 1, firstCallAt: callTime, lastCallAt: callTime });
    return lead._id;
  }

  const update = {
    $set: set,
    $inc: { callCount: 1 },
    $max: { lastCallAt: callTime },
    $min: { firstCallAt: callTime },
    $setOnInsert: { status: "new" },
  };

  // Two calls from the same new number can race to insert; the unique
  // index rejects the loser, which then just updates the winner's Lead.
  let lead;
  try {
    lead = await LeadModel.findOneAndUpdate({ phoneKey: key }, update, {
      upsert: true,
      returnDocument: "after",
    });
  } catch (error: unknown) {
    if (!isDuplicateKeyError(error)) throw error;
    lead = await LeadModel.findOneAndUpdate({ phoneKey: key }, update, { returnDocument: "after" });
  }

  if (!lead) throw new Error(`Lead for ${key} vanished during upsert.`);

  if (lead.status === "lost") {
    await LeadModel.updateOne({ _id: lead._id, status: "lost" }, { $set: { status: "new" } });
  }

  return lead._id;
}
