// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { siteConfigSchema } from "@/lib/content/types";
import { resolveAnalyticsConfig } from "@/lib/analytics/resolve";
import { AnalyticsScript } from "./AnalyticsScript";

/**
 * The tracker is the only part of this feature that touches a reader's browser,
 * so its default has to be "do nothing" and its exclusions have to be provable.
 *
 * Asserted against `renderToStaticMarkup`, not a client render: React 19 hoists
 * `<script src>` during client renders, which would hide exactly the tag this
 * component exists to emit. Server markup is also what a reader actually gets.
 */
function resolved(analytics: Record<string, unknown>, env: Record<string, string> = {}) {
  return resolveAnalyticsConfig(siteConfigSchema.parse({ analytics }), env);
}

function parse(markup: string): Document {
  return new DOMParser().parseFromString(markup || "<div></div>", "text/html");
}

const ENABLED = {
  enabled: true,
  provider: "umami",
  websiteId: "site-1",
  baseUrl: "https://analytics.example.com",
};

describe("<AnalyticsScript />", () => {
  it("renders nothing at all when analytics is disabled", () => {
    const markup = renderToStaticMarkup(
      <AnalyticsScript resolved={resolved({ ...ENABLED, enabled: false })} />
    );
    expect(markup).toBe("");
  });

  it("renders nothing when the configuration is incomplete", () => {
    const markup = renderToStaticMarkup(
      <AnalyticsScript resolved={resolved({ enabled: true, provider: "umami" })} />
    );
    expect(markup).toBe("");
  });

  it("does not require an API key — collection and reporting are separate", () => {
    const config = resolved(ENABLED);
    expect(config.reporting).toBe(false);
    const doc = parse(renderToStaticMarkup(<AnalyticsScript resolved={config} />));
    expect(doc.querySelectorAll("script")).toHaveLength(1);
  });

  it("emits one async, deferred script with the public identifiers only", () => {
    const markup = renderToStaticMarkup(
      <AnalyticsScript resolved={resolved(ENABLED, { ANALYTICS_API_KEY: "secret" })} />
    );
    const doc = parse(markup);
    const scripts = doc.querySelectorAll("script");
    expect(scripts).toHaveLength(1);

    const script = scripts[0];
    expect(script.getAttribute("src")).toBe("https://analytics.example.com/script.js");
    expect(script.getAttribute("data-website-id")).toBe("site-1");
    // No query-string collection: UTM values and stray tokens are not stored.
    expect(script.getAttribute("data-exclude-search")).toBe("true");
    // Async/defer so it can never block first paint.
    expect(script.hasAttribute("async")).toBe(true);
    expect(script.hasAttribute("defer")).toBe(true);
    // The server-side key must never reach the browser.
    expect(markup).not.toContain("secret");
  });

  it("refuses to emit a tracker with a non-http source", () => {
    const markup = renderToStaticMarkup(
      <AnalyticsScript resolved={resolved({ ...ENABLED, baseUrl: "javascript:alert(1)" })} />
    );
    expect(markup).toBe("");
  });
});
