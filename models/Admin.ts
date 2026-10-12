/**
 * models/Admin.ts
 *
 * Mongoose schema for admin dashboard users. Passwords are never stored
 * in plain text — only a bcrypt hash (see lib/auth.ts / scripts/create-admin.mjs).
 */

import { Schema, model, models } from "mongoose";

const AdminSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "" },
    // Brute-force protection — see app/api/admin/login/route.ts.
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
  },
  { timestamps: true }
);

export default models.Admin || model("Admin", AdminSchema);
