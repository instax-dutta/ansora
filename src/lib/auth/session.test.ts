import { describe, expect, it } from "vitest";
import { isCrossOrigin, verifyCredentials } from "./session";

function req(headers: Record<string, string>, url = "https://blog.example.com/api/admin/login") {
  return new Request(url, { method: "POST", headers });
}

describe("isCrossOrigin", () => {
  it("allows requests without an Origin header (curl, tests)", () => {
    expect(isCrossOrigin(req({}))).toBe(false);
  });

  it("allows same-origin requests", () => {
    expect(isCrossOrigin(req({ origin: "https://blog.example.com" }))).toBe(false);
  });

  it("allows same-origin behind a proxy (x-forwarded-host)", () => {
    const r = new Request("http://10.0.0.1:3000/api/admin/login", {
      method: "POST",
      headers: {
        origin: "https://blog.example.com",
        host: "10.0.0.1:3000",
        "x-forwarded-host": "blog.example.com",
      },
    });
    expect(isCrossOrigin(r)).toBe(false);
  });

  it("rejects foreign origins", () => {
    expect(isCrossOrigin(req({ origin: "https://evil.example.net" }))).toBe(true);
  });

  it("rejects malformed origins", () => {
    expect(isCrossOrigin(req({ origin: "::not-a-url::" }))).toBe(true);
  });
});

describe("verifyCredentials timing hardening", () => {
  it("still rejects a wrong username without throwing", async () => {
    process.env.ADMIN_USERNAME = "admin";
    // Valid-looking bcrypt hash of an unguessable password.
    process.env.ADMIN_PASSWORD_HASH =
      "$2a$10$N9qo8uLOickgx2ZMRZoMye.IjPeGqBQKzE1w0oJvUcTnGhYQ0fW0u";
    try {
      await expect(verifyCredentials("nope", "whatever")).resolves.toBe(false);
    } finally {
      delete process.env.ADMIN_USERNAME;
      delete process.env.ADMIN_PASSWORD_HASH;
    }
  });
});
