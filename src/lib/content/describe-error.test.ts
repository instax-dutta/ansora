import { describe, expect, it } from "vitest";
import { describeAdapterError } from "./index";

/**
 * This string is rendered into a public page, so credential scrubbing is a
 * security property rather than a formatting nicety. Octokit errors can embed
 * the request that failed, and the request carries the auth header.
 */
describe("describeAdapterError", () => {
  it("redacts a classic PAT", () => {
    const out = describeAdapterError(
      new Error("failed for ghp_abcdefghijklmnop1234")
    );
    expect(out).not.toContain("ghp_abcdefghijklmnop1234");
    expect(out).toContain("[redacted]");
  });

  it("redacts a fine-grained PAT", () => {
    const out = describeAdapterError(
      new Error("github_pat_11ABCDEFG0aBcDeFgHiJkL_MnOpQrStUvWxYz0123456789")
    );
    expect(out).not.toContain("github_pat_11ABCDEFG0aBcDeFgHiJkL_MnOpQrStUvWxYz0123456789");
  });

  it("redacts an inline authorization header", () => {
    const out = describeAdapterError(
      new Error("request failed, authorization: Bearer ghs_supersecretvalue123")
    );
    expect(out).not.toContain("ghs_supersecretvalue123");
    expect(out).not.toMatch(/Bearer\s+\S+/i);
  });

  it("redacts token= and api_key= style leaks", () => {
    for (const leak of [
      "token=abcdef123456",
      "secret: hunter2hunter2",
      "api_key: AKIAIOSFODNN7EXAMPLE",
    ]) {
      const out = describeAdapterError(new Error(`upstream said ${leak}`));
      expect(out).toContain("[redacted]");
    }
  });

  it("names a rate limit as the actionable cause, without echoing upstream text", () => {
    for (const status of [403, 429]) {
      const out = describeAdapterError({
        status,
        message: "API rate limit exceeded for ghp_abcdefghij123456",
      });
      expect(out).toMatch(/rate limited or unauthorized/i);
      expect(out).not.toContain("ghp_");
    }
  });

  it("reports a server error by status", () => {
    expect(describeAdapterError({ status: 502, message: "bad gateway" })).toContain(
      "502"
    );
  });

  it("truncates a very long message so a page cannot be flooded", () => {
    const out = describeAdapterError(new Error("x".repeat(5000)));
    expect(out.length).toBeLessThanOrEqual(260);
  });

  it("handles a thrown non-Error value", () => {
    expect(describeAdapterError("just a string")).toContain("just a string");
    expect(describeAdapterError(undefined)).toContain("undefined");
  });

  it("never emits a stack trace", () => {
    const err = new Error("nope");
    err.stack = "Error: nope\n    at someFunction (/app/src/secret/path.ts:1:1)";
    expect(describeAdapterError(err)).not.toContain("secret/path");
  });
});
