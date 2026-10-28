import type { NextConfig } from "next";

/**
 * Origins the configured analytics tracker needs the CSP to allow.
 *
 * A private, self-hosted analytics instance is a different origin from the
 * blog, and `script-src 'self'` blocks it outright — the tracker silently never
 * loads and the dashboard just looks empty. Rather than weakening the policy
 * with a blanket `https:`, the deployment names its tracker host in
 * `ANALYTICS_SCRIPT_ORIGIN` (or `ANALYTICS_BASE_URL`), and only that origin is
 * added to `script-src` and `connect-src`.
 *
 * Deliberately env-only: this file cannot read the content repo, and a
 * deployment-level policy belongs in deployment-level configuration. The admin
 * Analytics panel warns when the saved tracker host is not allowed here.
 */
function analyticsOrigins(): string[] {
  const origins = new Set<string>();
  for (const raw of [process.env.ANALYTICS_SCRIPT_ORIGIN, process.env.ANALYTICS_BASE_URL]) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
      if (url.protocol === "http:" || url.protocol === "https:") origins.add(url.origin);
    } catch {
      // A malformed value simply does not widen the policy.
    }
  }
  return [...origins];
}

const ANALYTICS_ORIGINS = analyticsOrigins();
const ANALYTICS_ORIGIN_SUFFIX = ANALYTICS_ORIGINS.length ? ` ${ANALYTICS_ORIGINS.join(" ")}` : "";

/**
 * Baseline security headers for every route. Kept deliberately compatible
 * with Next.js's inline bootstrap scripts and the server-rendered theme
 * <style> block (hence 'unsafe-inline' for script-src/style-src) — a
 * nonce-based CSP would force every page dynamic and break SSG/ISR.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    // Post images are external URLs by design (no uploads), hence https: img-src.
    value: [
      "default-src 'self'",
      "img-src 'self' https: data:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline'${ANALYTICS_ORIGIN_SUFFIX}`,
      "font-src 'self' data:",
      // The tracker posts pageviews back to its own origin, so that origin has
      // to be reachable as well as loadable.
      `connect-src 'self'${ANALYTICS_ORIGIN_SUFFIX}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  /**
   * Bake the CSP's analytics allowlist into the build.
   *
   * `headers()` is compiled into `.next/routes-manifest.json` at build time, so
   * the browser policy cannot change on restart — which means a deployment that
   * sets ANALYTICS_SCRIPT_ORIGIN only at runtime still gets a policy without it.
   * The admin Analytics panel reads this baked value to decide whether to warn,
   * so it reports the policy the browser will actually enforce instead of the
   * environment it was asked about.
   */
  env: { ANSORA_ANALYTICS_CSP_ORIGINS: ANALYTICS_ORIGINS.join(" ") },
  // Standalone output lets the Dockerfile ship a minimal production server.
  // On Vercel it's unnecessary and breaks its build (missing
  // .next/next-server.js.nft.json), so only enable it off-platform.
  output: process.env.VERCEL ? undefined : "standalone",
  // These packages use runtime `require()` / dynamic imports and are best
  // left unbundled and externalized to node_modules in the standalone build.
  serverExternalPackages: ["simple-git", "octokit"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  /**
   * Markdown content negotiation.
   *
   * An agent that asks for `text/markdown` gets the page's markdown source
   * instead of its HTML. That is lossless, far smaller, and saves the agent
   * from scraping navigation and inline styles out of the markup.
   *
   * Two deliberate constraints:
   * - `beforeFiles`, so the rewrite wins over the filesystem routes. With
   *   `afterFiles` the HTML page would always match first and never negotiate.
   * - Enumerated per-route rather than a `/:path*` catch-all, so an
   *   `Accept: text/markdown` request to `/admin` or `/api` can never be
   *   redirected into the public mirror.
   *
    * The trigger requires `text/markdown` to be *explicitly* present, so a
    * wildcard Accept header from curl, a monitor or a health check still
    * gets HTML.
    */
  async rewrites() {
    const markdown: { type: "header"; key: string; value: string }[] = [
      { type: "header", key: "accept", value: ".*text/markdown.*" },
    ];
    return {
      beforeFiles: [
        { source: "/", has: markdown, destination: "/md" },
        { source: "/blog", has: markdown, destination: "/md/blog" },
        { source: "/blog/:slug", has: markdown, destination: "/md/blog/:slug" },
        { source: "/tags", has: markdown, destination: "/md/tags" },
        { source: "/tags/:tag", has: markdown, destination: "/md/tags/:tag" },
        { source: "/about", has: markdown, destination: "/md/about" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
