import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import AdminModel from "@/models/Admin";
import { createSessionToken, ADMIN_SESSION_COOKIE, ADMIN_SESSION_DURATION_SECONDS } from "@/lib/auth";

interface LoginBody {
  email?: string;
  password?: string;
}

interface AdminDoc {
  _id: { toString(): string };
  email: string;
  passwordHash: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: LoginBody;

    try {
      body = (await req.json()) as LoginBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const email = body.email?.toLowerCase().trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    await connectToDatabase();
    const admin = (await AdminModel.findOne({ email }).lean()) as unknown as AdminDoc | null;

    const isValid = admin ? await bcrypt.compare(password, admin.passwordHash) : false;

    if (!admin || !isValid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = await createSessionToken({ adminId: admin._id.toString(), email: admin.email });

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error occurred.";
    console.error("[admin/login] Error:", message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
