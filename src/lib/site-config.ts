/**
 * Site-level settings helper with a short TTL cache, shared by layouts and
 * pages so the config file isn't re-read on every request.
 */
import { getAdapter } from "@/lib/content";
import type { SiteConfig } from "@/lib/content/types";

const TTL_MS = 30_000;
let cached: SiteConfig | null = null;
let cachedAt = 0;

export async function getSiteConfig(): Promise<SiteConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;
  cached = await getAdapter().getSiteConfig();
  // SITE_URL seeds the base URL until it's changed in Admin → Settings
  // (an explicit admin value always wins over the env var).
  if (cached.baseUrl === "http://localhost:3000" && process.env.SITE_URL) {
    cached = { ...cached, baseUrl: process.env.SITE_URL.replace(/\/+$/, "") };
  }
  cachedAt = now;
  return cached;
}
