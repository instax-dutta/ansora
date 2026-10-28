import { describe, expect, it } from "vitest";
import { siteConfigSchema } from "@/lib/content/types";
import {
  apiBaseFor,
  cspAllowsTracker,
  resolveAnalyticsConfig,
  trackerOriginOf,
} from "./resolve";

/**
 * Two different questions, deliberately answered separately:
 *
 * - `tracking`  — may the browser load a tracker? Needs host + website ID.
 * - `reporting` — may the server read numbers? Also needs an API key.
 *
 * Conflating them is how a site ends up silently collecting nothing, or an
 * author stares at an empty dashboard that is actually unauthenticated.
 */
const config = (analytics: Record<string, unknown> = {}) => siteConfigSchema.parse({ analytics });

describe("resolveAnalyticsConfig", () => {
  it("is disabled by default so an existing deployment keeps behaving identically", () => {
    const resolved = resolveAnalyticsConfig(config(), {});
    expect(resolved).toMatchObject({
      provider: "none",
      enabled: false,
      tracking: false,
      reporting: false,
      apiKey: null,
      websiteId: "",
      scriptUrl: "",
    });
    expect(resolved.missing).toContain("a provider");
  });

  it("enables tracking without an API key, and blocks only reporting", () => {
    const resolved = resolveAnalyticsConfig(
      config({
        enabled: true,
        provider: "umami",
        websiteId: "8f2c",
        baseUrl: "https://analytics.example.com",
      }),
      {}
    );
    expect(resolved.tracking).toBe(true);
    expect(resolved.reporting).toBe(false);
    expect(resolved.missing).toEqual(["ANALYTICS_API_KEY"]);
  });

  it("enables reporting when the server-side key is present", () => {
    const resolved = resolveAnalyticsConfig(
      config({
        enabled: true,
        provider: "umami",
        websiteId: "8f2c",
        baseUrl: "https://analytics.example.com",
      }),
      { ANALYTICS_API_KEY: "umami_secret" }
    );
    expect(resolved.reporting).toBe(true);
    expect(resolved.missing).toEqual([]);
  });

  it("lets environment variables configure a deployment without editing site config", () => {
    const resolved = resolveAnalyticsConfig(config(), {
      ANALYTICS_PROVIDER: "umami",
      ANALYTICS_WEBSITE_ID: "env-site",
      ANALYTICS_BASE_URL: "https://stats.example.com",
      ANALYTICS_API_KEY: "k",
    });
    expect(resolved.provider).toBe("umami");
    expect(resolved.websiteId).toBe("env-site");
    expect(resolved.baseUrl).toBe("https://stats.example.com");
    // Enabled stays an explicit author decision: an env var cannot switch
    // tracking on behind a writer's back.
    expect(resolved.enabled).toBe(false);
    expect(resolved.tracking).toBe(false);
    expect(resolved.reporting).toBe(false);
  });

  it("prefers the saved site config over environment fallbacks", () => {
    const resolved = resolveAnalyticsConfig(
      config({
        enabled: true,
        provider: "umami",
        websiteId: "from-config",
        baseUrl: "https://config.example.com",
      }),
      {
        ANALYTICS_PROVIDER: "umami",
        ANALYTICS_WEBSITE_ID: "from-env",
        ANALYTICS_BASE_URL: "https://env.example.com",
      }
    );
    expect(resolved.websiteId).toBe("from-config");
    expect(resolved.baseUrl).toBe("https://config.example.com");
  });

  it("ignores an unknown provider in the environment", () => {
    const resolved = resolveAnalyticsConfig(config(), { ANALYTICS_PROVIDER: "google-analytics-4" });
    expect(resolved.provider).toBe("none");
  });

  it("reports every missing piece in plain language", () => {
    const resolved = resolveAnalyticsConfig(config({ enabled: true, provider: "umami" }), {});
    expect(resolved.missing).toEqual(["a website ID", "a tracker URL", "ANALYTICS_API_KEY"]);
  });

  it("derives the script URL and keeps the API base separate", () => {
    const resolved = resolveAnalyticsConfig(
      config({
        enabled: true,
        provider: "umami",
        websiteId: "8f2c",
        baseUrl: "https://analytics.example.com/",
        reportBaseUrl: "https://api.umami.is/v1",
      }),
      { ANALYTICS_API_KEY: "k" }
    );
    expect(resolved.scriptUrl).toBe("https://analytics.example.com/script.js");
    expect(resolved.apiBase).toBe("https://api.umami.is/v1");
  });
});

describe("apiBaseFor", () => {
  it("appends the documented /api prefix to a bare instance URL", () => {
    expect(apiBaseFor("https://analytics.example.com")).toBe(
      "https://analytics.example.com/api"
    );
    expect(apiBaseFor("https://analytics.example.com/")).toBe(
      "https://analytics.example.com/api"
    );
  });

  it("keeps an explicit API path untouched", () => {
    expect(apiBaseFor("https://api.umami.is/v1")).toBe("https://api.umami.is/v1");
    expect(apiBaseFor("https://analytics.example.com/api/")).toBe(
      "https://analytics.example.com/api"
    );
  });

  it("returns null for anything that is not an absolute http(s) URL", () => {
    expect(apiBaseFor("")).toBeNull();
    expect(apiBaseFor("/api")).toBeNull();
    expect(apiBaseFor("javascript:alert(1)")).toBeNull();
  });
});

describe("trackerOriginOf + cspAllowsTracker", () => {
  const resolved = resolveAnalyticsConfig(
    config({
      enabled: true,
      provider: "umami",
      websiteId: "8f2c",
      baseUrl: "https://analytics.example.com",
    }),
    { ANALYTICS_API_KEY: "k" }
  );

  it("extracts the tracker origin", () => {
    expect(trackerOriginOf(resolved)).toBe("https://analytics.example.com");
  });

  it("detects that the Content-Security-Policy would block a third-party tracker", () => {
    expect(cspAllowsTracker(resolved, {})).toBe(false);
    expect(
      cspAllowsTracker(resolved, { ANALYTICS_SCRIPT_ORIGIN: "https://analytics.example.com" })
    ).toBe(true);
    // A host-only entry is accepted and normalised to an origin.
    expect(
      cspAllowsTracker(resolved, { ANALYTICS_BASE_URL: "https://analytics.example.com" })
    ).toBe(true);
  });

  it("trusts the policy baked into the build over the current environment", () => {
    // headers() is compiled at build time, so a runtime-only env var does not
    // change what the browser enforces. The panel must not claim otherwise.
    expect(
      cspAllowsTracker(resolved, { ANSORA_ANALYTICS_CSP_ORIGINS: "" })
    ).toBe(false);
    expect(
      cspAllowsTracker(resolved, {
        ANSORA_ANALYTICS_CSP_ORIGINS: "https://analytics.example.com",
        ANALYTICS_SCRIPT_ORIGIN: "https://other.example.com",
      })
    ).toBe(true);
  });

  it("reports no tracker origin when tracking is off", () => {
    const disabled = resolveAnalyticsConfig(config(), {});
    expect(trackerOriginOf(disabled)).toBeNull();
    expect(cspAllowsTracker(disabled, {})).toBe(true);
  });
});
