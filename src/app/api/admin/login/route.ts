import { NextRequest, NextResponse } from "next/server";
import {
  clientIp,
  createSessionToken,
  isRateLimited,
  recordLoginFailure,
  SESSION_COOKIE,
  verifyCredentials,
} from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  // Basic in-memory throttle (single admin — acceptable per spec). Only
  // failed attempts count toward the budget.
  const ip = clientIp(request.headers);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  let username = "";
  let password = "";
  try {
    const body = await request.json();
    username = String(body?.username ?? "");
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  let valid: boolean;
  try {
    valid = await verifyCredentials(username, password);
  } catch (err) {
    // Misconfiguration (missing env vars) must not look like a wrong password.
    console.error("Login misconfiguration:", err);
    return NextResponse.json(
      { error: "The server is not configured for admin access." },
      { status: 500 }
    );
  }

  if (!valid) {
    recordLoginFailure(ip);
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
