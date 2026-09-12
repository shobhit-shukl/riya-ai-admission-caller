#!/usr/bin/env node
/**
 * scripts/create-admin.mjs
 *
 * Creates (or resets the password for) an admin dashboard account.
 * There's no public sign-up endpoint on purpose — admins are provisioned
 * from the command line instead.
 *
 * Usage:
 *   node scripts/create-admin.mjs <email> <password> ["Display Name"]
 */

import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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

// Mirrors models/Admin.ts — duplicated here since this script runs via
// plain `node`, without a TypeScript loader.
const AdminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "" },
  },
  { timestamps: true }
);

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

async function main() {
  const [, , email, password, name] = process.argv;

  if (!email || !password) {
    console.error("Usage: node scripts/create-admin.mjs <email> <password> [\"Display Name\"]");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  loadEnvLocal();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI — set it in .env.local first.");
    process.exit(1);
  }

  await connectWithSrvDnsFallback(uri);

  const Admin = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await Admin.findOneAndUpdate(
    { email: normalizedEmail },
    { email: normalizedEmail, passwordHash, name: name ?? "" },
    { upsert: true, returnDocument: "after" }
  );

  console.log(`Admin account ready: ${admin.email}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Failed to create admin:", error);
  process.exit(1);
});
