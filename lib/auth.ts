/**
 * lib/auth.ts
 *
 * Signs and verifies the admin dashboard's session cookie. Uses `jose`
 * (rather than `jsonwebtoken`) because it works in both the Node.js and
 * Edge runtimes with no native dependencies.
 */

import { SignJWT, jwtVerify } from "jose";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AdminSessionPayload {
  adminId: string;
  email: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET environment variable.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

/** Returns the decoded session payload, or null if the token is missing/invalid/expired. */
export async function verifySessionToken(token: string | undefined): Promise<AdminSessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    if (typeof payload.adminId !== "string" || typeof payload.email !== "string") {
      return null;
    }

    return { adminId: payload.adminId, email: payload.email };
  } catch {
    return null;
  }
}
