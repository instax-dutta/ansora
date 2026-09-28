import { describe, expect, it } from "vitest";
import { resolveTagFromSlug, tagSlug } from "./utils";

/**
 * Backward compatibility is the whole point of this file.
 *
 * Existing Ansora deployments have tag URLs already published, bookmarked and
 * linked from elsewhere, in the form `/tags/<raw tag>`. The normalization must
 * therefore never *invalidate* a URL, only give it a canonical form.
 */
describe("tagSlug", () => {
  it("leaves already-URL-safe tags untouched", () => {
    // The overwhelmingly common case: these blogs must not change at all.
    expect(tagSlug("self-hosting")).toBe("self-hosting");
    expect(tagSlug("docker")).toBe("docker");
    expect(tagSlug("meta")).toBe("meta");
  });

  it("normalizes tags that were never URL-safe", () => {
    expect(tagSlug("SEO")).toBe("seo");
    expect(tagSlug("Search Engine Optimization")).toBe(
      "search-engine-optimization"
    );
    expect(tagSlug("Node.js")).toBe("node-js");
  });

  it("decodes percent-encoding and tolerates malformed input", () => {
    expect(tagSlug("Search%20Engine%20Optimization")).toBe(
      "search-engine-optimization"
    );
    // A stray % must not throw — a malformed URL should not 500 a page.
    expect(() => tagSlug("100%")).not.toThrow();
    expect(tagSlug("100%")).toBe("100");
  });

  it("is idempotent", () => {
    expect(tagSlug(tagSlug("Search Engine Optimization"))).toBe(
      "search-engine-optimization"
    );
  });
});

describe("resolveTagFromSlug", () => {
  const tags = ["self-hosting", "SEO", "Search Engine Optimization", "docker"];

  it("resolves a legacy raw tag URL to its raw tag", () => {
    // These URLs exist in the wild on running deployments.
    expect(resolveTagFromSlug(tags, "SEO")).toBe("SEO");
    expect(resolveTagFromSlug(tags, "Search Engine Optimization")).toBe(
      "Search Engine Optimization"
    );
    expect(resolveTagFromSlug(tags, "Search%20Engine%20Optimization")).toBe(
      "Search Engine Optimization"
    );
  });

  it("resolves the normalized form to the same raw tag", () => {
    expect(resolveTagFromSlug(tags, "seo")).toBe("SEO");
    expect(resolveTagFromSlug(tags, "search-engine-optimization")).toBe(
      "Search Engine Optimization"
    );
  });

  it("round-trips every tag through its own URL", () => {
    for (const tag of tags) {
      expect(resolveTagFromSlug(tags, tagSlug(tag))).toBe(tag);
    }
  });

  it("returns null for an unknown slug so the route can 404", () => {
    expect(resolveTagFromSlug(tags, "does-not-exist")).toBeNull();
    expect(resolveTagFromSlug([], "anything")).toBeNull();
  });

  it("does not match a tag that slugifies to empty", () => {
    expect(resolveTagFromSlug(["!!!"], "---")).toBeNull();
  });
});
