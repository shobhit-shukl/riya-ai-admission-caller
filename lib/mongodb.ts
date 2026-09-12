/**
 * lib/mongodb.ts
 *
 * Cached Mongoose connection helper. Next.js reuses modules across hot
 * reloads in dev and across invocations in serverless, so the connection
 * (and its in-flight promise) is stashed on `global` to avoid opening a
 * new connection per request.
 */

import dns from "node:dns";
import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

/**
 * Some local networks (VPNs, security software, certain Windows setups)
 * point Node's DNS resolver at a stub server that refuses SRV queries,
 * even though regular lookups work fine. That breaks `mongodb+srv://`
 * URIs with `querySrv ECONNREFUSED` despite the connection string itself
 * being perfectly valid. If that specific failure happens, retry once
 * against a public DNS server instead of failing the whole request.
 */
// Fail fast rather than hang the webhook if Atlas is briefly unreachable —
// the record still needs to make it into the Sheet in real time either way.
const CONNECT_OPTIONS = { serverSelectionTimeoutMS: 8_000 };

async function connectWithSrvDnsFallback(uri: string): Promise<typeof mongoose> {
  try {
    return await mongoose.connect(uri, CONNECT_OPTIONS);
  } catch (error) {
    const isSrvDnsFailure =
      uri.startsWith("mongodb+srv://") &&
      error instanceof Error &&
      /querySrv|EREFUSED|ECONNREFUSED/i.test(error.message);

    if (!isSrvDnsFailure) {
      throw error;
    }

    console.warn(
      "[mongodb] SRV DNS lookup failed via the system resolver — retrying with a public DNS server."
    );
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    return mongoose.connect(uri, CONNECT_OPTIONS);
  }
}

/**
 * Connects to MongoDB using the MONGODB_URI environment variable
 * (the database name is expected to be part of the connection string).
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = connectWithSrvDnsFallback(uri).catch((error) => {
      cache.promise = null;
      throw error;
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
