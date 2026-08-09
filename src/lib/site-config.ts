/**
 * Site-level settings helper with a short TTL cache, shared by layouts and
 * pages so the config file isn't re-read on every request.
 */
import { getAdapter } from "@/lib/content";
import { DEFAULT_SITE_CONFIG, type SiteConfig } from "@/lib/content/types";

const TTL_MS = 30_000;
let cached: SiteConfig | null = null;
let cachedAt = 0;

export async function getSiteConfig(): Promise<SiteConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;
  try {
    cached = await getAdapter().getSiteConfig();
  } catch (err) {
    // Degrade gracefully: if the content adapter is unreachable (e.g. a
    // serverless build without GITHUB_REPO/GITHUB_TOKEN while prerendering,
    // or a transient API error), serve the defaults rather than failing the
    // page/build. Admin + API writes still surface adapter errors loudly.
    console.warn("[site-config] Using default config — content adapter unreachable:", err);
    cached = DEFAULT_SITE_CONFIG;
  }
  // SITE_URL seeds the base URL until it's changed in Admin → Settings
  // (an explicit admin value always wins over the env var).
  if (cached.baseUrl === "http://localhost:3000" && process.env.SITE_URL) {
    cached = { ...cached, baseUrl: process.env.SITE_URL.replace(/\/+$/, "") };
  }
  cachedAt = now;
  return cached;
}
