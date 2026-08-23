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
 * Burn a bcrypt comparison even when the username is wrong so response
 * latency doesn't reveal whether the configured ADMIN_USERNAME matches.
 * The hash itself is never matched by any real password.
 */
const DUMMY_HASH = "$2a$10$C6UzMDM.H6dfI/f/IKcEeO7ZBpQeFHRmW3lV0iO5uRhHhB0C0R1Xe";

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
  if (!safeEqual(username, expectedUser)) {
    // Same work as the happy path — no timing oracle on the username.
    await bcrypt.compare(password, DUMMY_HASH);
    return false;
  }
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
/**
 * Cap on tracked IPs. x-forwarded-for is client-suppliable, so without a cap
 * a spoofed flood of distinct values could grow this map without bound.
 */
const MAX_TRACKED_IPS = 10_000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function pruneExpired(now: number): void {
  if (loginAttempts.size === 0) return;
  for (const [ip, entry] of loginAttempts) {
    if (entry.resetAt < now) loginAttempts.delete(ip);
  }
}

/** True when this IP has exceeded the failed-attempt budget. */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.delete(ip);
    pruneExpired(now);
    return false;
  }
  // Allow LOGIN_MAX_ATTEMPTS failures, block the next attempt.
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

/** Record a failed login attempt for this IP. */
export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  pruneExpired(now);
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
    return;
  }
  // Hard memory bound: evict the oldest entries once the cap is exceeded.
  while (loginAttempts.size > MAX_TRACKED_IPS) {
    const oldest = loginAttempts.keys().next().value;
    if (oldest === undefined) break;
    loginAttempts.delete(oldest);
  }
}

/** Best-effort client IP from request headers. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/**
 * CSRF defense-in-depth for mutating admin API routes.
 *
 * The session cookie is SameSite=Lax, which already blocks most cross-site
 * POSTs; this adds an explicit Origin check so a forged request from another
 * origin is rejected even if a browser relaxes cookie semantics. Requests
 * without an Origin header (curl, tests, same-origin fetches in some
 * browsers on GET-only flows) are allowed — the check only rejects requests
 * that *claim* a foreign origin.
 */
export function isCrossOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true;
  }
  // Behind proxies the public host arrives via x-forwarded-host; a bare
  // request falls back to the URL's own host.
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  return originHost !== host;
}
