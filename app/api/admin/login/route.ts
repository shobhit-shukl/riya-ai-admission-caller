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
  failedLoginAttempts?: number;
  lockUntil?: Date;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Compared against when the email doesn't exist, so an unknown email takes
// as long as a wrong password and response timing can't reveal which
// admin emails are real.
const DUMMY_PASSWORD_HASH = "$2b$12$4zGbsoR.InyP2PKyp3n68uONMDVHvml/opj8RGfPywMUR7.NfvVgq";

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

    if (admin?.lockUntil && admin.lockUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((admin.lockUntil.getTime() - Date.now()) / 60_000);
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    const isValid = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!admin || !isValid) {
      if (admin) {
        const attempts = (admin.failedLoginAttempts ?? 0) + 1;
        await AdminModel.updateOne(
          { _id: admin._id },
          attempts >= MAX_FAILED_ATTEMPTS
            ? { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) }
            : { failedLoginAttempts: attempts }
        );
      }
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (admin.failedLoginAttempts || admin.lockUntil) {
      await AdminModel.updateOne({ _id: admin._id }, { failedLoginAttempts: 0, $unset: { lockUntil: 1 } });
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
