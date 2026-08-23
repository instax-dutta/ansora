import type { NextConfig } from "next";

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
      "script-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Standalone output lets the Dockerfile ship a minimal production server.
  output: "standalone",
  // These packages use runtime `require()` / dynamic imports and are best
  // left unbundled and externalized to node_modules in the standalone build.
  serverExternalPackages: ["simple-git", "octokit"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
