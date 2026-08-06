import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSessionToken,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session";
import { POST } from "./route";

// 48 chars — passes the >= 32 requirement.
const SECRET = "test-jwt-secret-0123456789abcdef0123456789abcdef";
const HASH = bcrypt.hashSync("testpass123", 10);

const BASE_IP = "203.0.113.9";

function postJson(body: unknown, ip = BASE_IP) {
  return new NextRequest("http://localhost:3000/api/admin/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", SECRET);
  vi.stubEnv("ADMIN_USERNAME", "admin");
  vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/admin/login", () => {
  it("returns an httpOnly session cookie for valid credentials", async () => {
    const res = await POST(
      postJson({ username: "admin", password: "testpass123" })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toBeTruthy();
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("ansora_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=604800"); // 7 days

    // The issued token is a real, verifiable session.
    expect(await verifySessionToken(cookie!.value)).toBe(true);
  });

  it("rejects a wrong password without setting a cookie", async () => {
    const res = await POST(
      postJson({ username: "admin", password: "wrong-password" }, "203.0.113.10")
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: /Invalid username or password/,
    });
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("rejects a wrong username with the same error", async () => {
    const res = await POST(
      postJson({ username: "hacker", password: "testpass123" }, "203.0.113.11")
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: /Invalid username or password/,
    });
  });

  it("requires both username and password", async () => {
    const res = await POST(postJson({ username: "admin" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: /Username and password are required/,
    });
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(postJson("{oops", "203.0.113.12"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: /Invalid request body/,
    });
  });

  it("returns 500 (not a credential failure) when admin is unconfigured", async () => {
    const oldUser = process.env.ADMIN_USERNAME;
    const oldHash = process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD_HASH;
    try {
      const res = await POST(
        postJson({ username: "admin", password: "testpass123" })
      );
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toMatchObject({
        error: /not configured for admin access/,
      });
    } finally {
      process.env.ADMIN_USERNAME = oldUser;
      process.env.ADMIN_PASSWORD_HASH = oldHash;
    }
  });

  it("rate-limits after five failed attempts from the same IP", async () => {
    const ip = "198.51.100.99";
    for (let i = 0; i < 5; i++) {
      const res = await POST(
        postJson({ username: "admin", password: "wrong" }, ip)
      );
      expect(res.status).toBe(401);
    }
    // Correct credentials are still throttled — the budget is per-IP.
    const blocked = await POST(
      postJson({ username: "admin", password: "testpass123" }, ip)
    );
    expect(blocked.status).toBe(429);
  });

  it("issues a token that passes real verification against the session lib", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
    expect(await verifySessionToken("not-a-real-token")).toBe(false);
  });
});
