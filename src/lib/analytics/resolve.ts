/**
 * Resolve the analytics integration from site config + environment.
 *
 * Two questions, answered separately and never conflated:
 *
 * - `tracking`  — may the browser load a tracker? Needs a provider, a website
 *   ID and a tracker URL. No credential required.
 * - `reporting` — may the server read numbers? Additionally needs the
 *   server-side API key.
 *
 * A deployment can therefore collect data while the dashboard says "add an API
 * key", instead of the site appearing to be unconfigured when it is actually
 * collecting fine.
 *
 * Configuration precedence: saved site config wins; environment variables fill
 * the gaps so a deployment can be wired up without editing the content repo.
 * `enabled` is deliberately *not* env-settable — switching tracking on for a
 * writer who never opted in is exactly what the no-tracking-by-default rule
 * forbids.
 */
import type { SiteConfig } from "@/lib/content/types";

export type AnalyticsProviderId = "none" | "umami";

const KNOWN_PROVIDERS: AnalyticsProviderId[] = ["none", "umami"];

export interface ResolvedAnalytics {
  provider: AnalyticsProviderId;
  /** The author's opt-in switch, as saved. */
  enabled: boolean;
  websiteId: string;
  /** Tracker host / instance URL, without a trailing slash. */
  baseUrl: string;
  /** Reporting API base, or null when unset/unusable. */
  apiBase: string | null;
  scriptUrl: string;
  /** Presence only is public; the value never leaves the server. */
  apiKey: string | null;
  tracking: boolean;
  reporting: boolean;
  /** Human-readable list of what still needs configuring. */
  missing: string[];
}

/**
 * The timezone every report date is expressed in.
 *
 * One deployment-level setting, surfaced in the API and the UI, so "last 30
 * days" cannot mean three different things. Defaults to UTC rather than the
 * server's local zone, which differs between a laptop, a container and a
 * serverless region.
 */
export function siteTimezone(env: Record<string, string | undefined> = process.env): string {
  return (env.SITE_TIMEZONE ?? "").trim() || "UTC";
}

function envValue(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * The provider API base for a configured instance URL.
 *
 * A bare instance URL gets the documented `/api` suffix; an explicit API base
 * (Umami Cloud's `/v1`, or a reverse proxy) is used verbatim. Returning null —
 * rather than throwing — keeps a typo in one optional setting from taking down
 * the whole site config.
 */
export function apiBaseFor(url: string): string | null {
  const trimmed = stripTrailingSlash(url.trim());
  if (!trimmed || !isHttpUrl(trimmed)) return null;
  const parsed = new URL(trimmed);
  const path = stripTrailingSlash(parsed.pathname);
  const base = `${parsed.origin}${path}`;
  return path === "" || path === "/" ? `${parsed.origin}/api` : base;
}

/** Host+scheme of the configured tracker, for CSP diagnostics. */
export function trackerOriginOf(resolved: ResolvedAnalytics): string | null {
  if (!resolved.tracking || !resolved.scriptUrl) return null;
  try {
    return new URL(resolved.scriptUrl).origin;
  } catch {
    return null;
  }
}

function normaliseOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Would the deployment's Content-Security-Policy allow the tracker request?
 *
 * `next.config.ts` derives the analytics origins in `script-src`/`connect-src`
 * from `ANALYTICS_SCRIPT_ORIGIN` / `ANALYTICS_BASE_URL` — but `headers()` is
 * baked into the build, so the browser enforces the origins that were present
 * at build time, not the ones in the environment now. `ANSORA_ANALYTICS_CSP_ORIGINS`
 * carries that baked list, and it wins when present so the setup panel never
 * claims a tracker is allowed when the served policy would block it.
 *
 * Without a baked list (dev server, tests) the current environment is used.
 */
export function cspAllowsTracker(
  resolved: ResolvedAnalytics,
  env: Record<string, string | undefined> = process.env
): boolean {
  const origin = trackerOriginOf(resolved);
  if (!origin) return true;

  const baked = envValue(env, "ANSORA_ANALYTICS_CSP_ORIGINS");
  const source = baked
    ? baked.split(/\s+/)
    : [envValue(env, "ANALYTICS_SCRIPT_ORIGIN"), envValue(env, "ANALYTICS_BASE_URL")];
  const allowed = source
    .map(normaliseOrigin)
    .filter((value): value is string => value !== null);
  return allowed.includes(origin);
}

/** Resolve everything the runtime needs to know about analytics. */
export function resolveAnalyticsConfig(
  config: Pick<SiteConfig, "analytics">,
  env: Record<string, string | undefined> = process.env
): ResolvedAnalytics {
  const saved = config.analytics;

  const configuredProvider = (saved.provider ?? "").toLowerCase();
  const envProvider = envValue(env, "ANALYTICS_PROVIDER").toLowerCase();
  const provider: AnalyticsProviderId =
    configuredProvider !== "none" && KNOWN_PROVIDERS.includes(configuredProvider as AnalyticsProviderId)
      ? (configuredProvider as AnalyticsProviderId)
      : envProvider && KNOWN_PROVIDERS.includes(envProvider as AnalyticsProviderId) && envProvider !== "none"
        ? (envProvider as AnalyticsProviderId)
        : "none";

  const websiteId = saved.websiteId.trim() || envValue(env, "ANALYTICS_WEBSITE_ID");
  const baseUrl = stripTrailingSlash(saved.baseUrl.trim() || envValue(env, "ANALYTICS_BASE_URL"));
  const reportOverride = saved.reportBaseUrl.trim();

  const safeBaseUrl = isHttpUrl(baseUrl) ? baseUrl : "";
  const scriptUrl = safeBaseUrl ? `${safeBaseUrl}/script.js` : "";
  const apiBase = apiBaseFor(reportOverride) ?? apiBaseFor(safeBaseUrl) ?? null;

  // Presence only: the key itself is never returned to a client or a log line.
  const apiKey = envValue(env, "ANALYTICS_API_KEY") || null;

  const enabled = saved.enabled === true;
  const tracking = enabled && provider !== "none" && websiteId !== "" && scriptUrl !== "";
  const reporting = tracking && apiKey !== null && apiBase !== null;

  const missing: string[] = [];
  if (provider === "none") missing.push("a provider");
  if (!websiteId) missing.push("a website ID");
  if (!scriptUrl) missing.push("a tracker URL");
  if (!apiKey) missing.push("ANALYTICS_API_KEY");

  return {
    provider,
    enabled,
    websiteId,
    baseUrl: safeBaseUrl,
    apiBase,
    scriptUrl,
    apiKey,
    tracking,
    reporting,
    missing,
  };
}
