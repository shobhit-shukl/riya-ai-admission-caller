#!/usr/bin/env node
/**
 * scripts/backfill-leads.mjs
 *
 * One-off migration: groups calls logged before leads existed into Lead
 * documents (one per phone number), exactly as the webhook now does for
 * new calls. Safe to re-run — calls that already have a leadId are skipped.
 *
 * Usage:
 *   node scripts/backfill-leads.mjs
 */

import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import mongoose from "mongoose";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function connectWithSrvDnsFallback(uri) {
  try {
    return await mongoose.connect(uri);
  } catch (error) {
    const isSrvDnsFailure =
      uri.startsWith("mongodb+srv://") && /querySrv|EREFUSED|ECONNREFUSED/i.test(error.message);

    if (!isSrvDnsFailure) throw error;

    console.warn("SRV DNS lookup failed via the system resolver — retrying with a public DNS server.");
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    return mongoose.connect(uri);
  }
}

// Mirrors phoneKey / normalizeLeadTemperature in lib/leadPipeline.ts and
// the merge rules in lib/leadStore.ts — duplicated since this script runs
// via plain `node`, without a TypeScript loader.
function phoneKey(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function normalizeLeadTemperature(value) {
  const match = ["Hot", "Warm", "Cold"].find((t) => t.toLowerCase() === String(value ?? "").trim().toLowerCase());
  return match ?? "";
}

const DETAIL_FIELDS = [
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

async function main() {
  loadEnvLocal();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI — set it in .env.local first.");
    process.exit(1);
  }

  await connectWithSrvDnsFallback(uri);
  const db = mongoose.connection.db;
  const calls = db.collection("callrecords");
  const leads = db.collection("leads");

  // Same unique index the app's Lead model declares.
  await leads.createIndex(
    { phoneKey: 1 },
    { name: "phoneKey_unique", unique: true, partialFilterExpression: { phoneKey: { $type: "string" } } }
  );

  // Oldest first, so each lead ends up with its latest non-empty details.
  const cursor = calls.find({ leadId: { $exists: false } }).sort({ timestamp: 1 });
  let processed = 0;

  for await (const call of cursor) {
    const set = {};
    for (const field of DETAIL_FIELDS) {
      const raw = String(call[field] ?? "").trim();
      const value = field === "leadTemperature" ? normalizeLeadTemperature(raw) : raw;
      if (value && value !== "Unknown") set[field] = value;
    }

    const callTime = call.endedAt ?? call.timestamp ?? new Date();
    const now = new Date();
    const key = phoneKey(call.callerNumber);
    let leadId;

    if (!key) {
      const result = await leads.insertOne({
        ...set,
        status: "new",
        followUpAt: null,
        notes: [],
        callCount: 1,
        firstCallAt: callTime,
        lastCallAt: callTime,
        createdAt: now,
        updatedAt: now,
      });
      leadId = result.insertedId;
    } else {
      const lead = await leads.findOneAndUpdate(
        { phoneKey: key },
        {
          $set: { ...set, updatedAt: now },
          $inc: { callCount: 1 },
          $max: { lastCallAt: callTime },
          $min: { firstCallAt: callTime },
          $setOnInsert: { status: "new", followUpAt: null, notes: [], createdAt: now },
        },
        { upsert: true, returnDocument: "after" }
      );
      leadId = lead._id;
    }

    await calls.updateOne({ _id: call._id }, { $set: { leadId } });
    processed += 1;
  }

  console.log(`Linked ${processed} call(s) to leads. Total leads: ${await leads.countDocuments()}.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
