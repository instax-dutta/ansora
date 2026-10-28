import { describe, expect, it } from "vitest";
import { siteConfigSchema } from "@/lib/content/types";
import { resolveAnalyticsConfig } from "./resolve";
import { isTrackablePath, trackerConfigFor } from "./privacy";

/**
 * Privacy contract: nothing under /admin, /api or the /md mirror is ever
 * tracked, and a disabled integration emits no script at all.
 */
describe("isTrackablePath", () => {
  it("tracks the public reading surface", () => {
    for (const path of ["/", "/blog", "/blog/self-hosting", "/tags/seo", "/about"]) {
      expect(isTrackablePath(path), path).toBe(true);
    }
  });

  it("never tracks admin, API, markdown or framework routes", () => {
    for (const path of [
      "/admin",
      "/admin/login",
      "/admin/analytics/posts/self-hosting",
      "/api/admin/posts",
      "/api/analytics/event",
      "/md",
      "/md/blog/self-hosting",
      "/_next/static/chunk.js",
      "/.well-known/security.txt",
      "/icon.svg",
      "/rss.xml",
      "/feed.json",
      "/sitemap.xml",
      "/robots.txt",
      "/llms.txt",
      "/llms-full.txt",
      "/search-index.json",
    ]) {
      expect(isTrackablePath(path), path).toBe(false);
    }
  });

  it("ignores query strings and a missing leading slash", () => {
    expect(isTrackablePath("/blog/x?utm_source=news")).toBe(true);
    expect(isTrackablePath("blog/x")).toBe(true);
    expect(isTrackablePath("")).toBe(false);
  });
});

describe("trackerConfigFor", () => {
  const config = (analytics: Record<string, unknown>) =>
    siteConfigSchema.parse({ analytics });

  it("emits nothing while analytics is disabled", () => {
    const resolved = resolveAnalyticsConfig(
      config({ provider: "umami", websiteId: "abc", baseUrl: "https://a.example.com" }),
      {}
    );
    expect(resolved.tracking).toBe(false);
    expect(trackerConfigFor(resolved)).toBeNull();
  });

  it("emits nothing when the integration is enabled but incomplete", () => {
    const resolved = resolveAnalyticsConfig(config({ enabled: true, provider: "umami" }), {});
    expect(trackerConfigFor(resolved)).toBeNull();
  });

  it("builds the documented tracker for a complete configuration", () => {
    const resolved = resolveAnalyticsConfig(
      config({
        enabled: true,
        provider: "umami",
        websiteId: "8f2c",
        baseUrl: "https://analytics.example.com",
      }),
      {}
    );
    expect(trackerConfigFor(resolved)).toEqual({
      src: "https://analytics.example.com/script.js",
      websiteId: "8f2c",
      excludeSearch: true,
    });
  });

  it("refuses a non-http tracker URL", () => {
    const resolved = resolveAnalyticsConfig(
      config({
        enabled: true,
        provider: "umami",
        websiteId: "8f2c",
        baseUrl: "javascript:alert(1)",
      }),
      {}
    );
    expect(resolved.tracking).toBe(false);
    expect(trackerConfigFor(resolved)).toBeNull();
  });
});
