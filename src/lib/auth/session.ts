/**
 * Admin session handling.
 *
 * Single-admin auth: credentials come from env vars (ADMIN_USERNAME +
 * ADMIN_PASSWORD_HASH, a bcrypt hash — never plaintext). A signed JWT lives
 * in an httpOnly cookie. There is no user table and no third-party provider.
 */
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE = "ansora_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be set to a random string of at least 32 characters."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ sub: "admin", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.sub === "admin";
  } catch {
    return false;
  }
}

/**
 * Read + verify the session cookie. For use in server components and layouts.
 * Always resolves to a boolean (false = unauthenticated).
 */
export async function getSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return false;
    return verifySessionToken(token);
  } catch {
    return false;
  }
}

/** Constant-time string comparison (avoids leaking username via timing). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

/**
 * Verify a username/password pair against env config. Also validates that the
 * configured hash looks like a bcrypt hash so misconfiguration fails loudly.
 */
export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedUser || !expectedHash || !expectedHash.startsWith("$2")) {
    throw new Error(
      "Admin credentials are not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD_HASH (generate with `npm run hash-password`)."
    );
  }
  if (!safeEqual(username, expectedUser)) return false;
  // bcrypt.compare is inherently timing-safe against the stored hash.
  return bcrypt.compare(password, expectedHash);
}

/**
 * Basic in-memory login throttle (single-admin scope makes this acceptable).
 * Only *failed* attempts count, so a successful login can never lock you out.
 * Serverless caveat: the map is per-instance, so this is a soft throttle.
 */
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

/** True when this IP has exceeded the failed-attempt budget. */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.delete(ip);
    return false;
  }
  // Allow LOGIN_MAX_ATTEMPTS failures, block the next attempt.
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

/** Record a failed login attempt for this IP. */
export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/** Best-effort client IP from request headers. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
