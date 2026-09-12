import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}
