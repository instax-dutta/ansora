/**
 * What is allowed to be measured, and what the tracker may do.
 *
 * The exclusion list is a privacy contract, not a preference. Admin pages,
 * API responses and the `/md` mirror are not reading activity, and a tracker
 * that fires on `/admin` measures the author's own editing rather than the
 * audience's reading.
 */
import type { ResolvedAnalytics } from "./resolve";

/** Route prefixes that are never tracked. */
export const TRACKING_EXCLUDED_PREFIXES = [
  "/admin",
  "/api",
  "/md",
  "/_next",
  "/.well-known",
] as const;

/** Machine-readable endpoints and assets that are not articles. */
export const TRACKING_EXCLUDED_PATHS = [
  "/icon.svg",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
  "/rss.xml",
  "/feed.json",
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
  "/llms-full.txt",
  "/search-index.json",
] as const;

/** Normalise a pathname for the checks below (drops query, hash, trailing `/`). */
function pathnameOnly(pathname: string): string {
  const withoutQuery = pathname.split("#")[0].split("?")[0].trim();
  if (!withoutQuery) return "";
  const withSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

/** Should this public pathname emit a pageview? */
export function isTrackablePath(pathname: string): boolean {
  const path = pathnameOnly(pathname);
  if (!path) return false;
  for (const prefix of TRACKING_EXCLUDED_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return false;
  }
  return !(TRACKING_EXCLUDED_PATHS as readonly string[]).includes(path);
}

export interface TrackerConfig {
  /** Absolute URL of the provider's tracker script. */
  src: string;
  /** Public site identifier. Never a credential. */
  websiteId: string;
  /** Ask the provider to drop the query string from every pageview. */
  excludeSearch: true;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The tracker to render, or null for "emit nothing at all".
 *
 * Null is the answer for disabled, half-configured and unsafe configurations —
 * the public page must never contain a broken or hostile script.
 */
export function trackerConfigFor(resolved: ResolvedAnalytics): TrackerConfig | null {
  if (!resolved.tracking) return null;
  if (!resolved.scriptUrl || !isHttpUrl(resolved.scriptUrl)) return null;
  if (!resolved.websiteId) return null;
  return {
    src: resolved.scriptUrl,
    websiteId: resolved.websiteId,
    excludeSearch: true,
  };
}
