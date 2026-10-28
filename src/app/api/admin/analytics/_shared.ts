/**
 * Shared plumbing for the analytics admin API.
 *
 * Every route under this folder is read-only reporting except `/config` and
 * `/verify`. They all go through the same three gates — origin, session, then
 * bounded query validation — because an analytics report names the site's
 * content and, if it ever leaked, would reveal which drafts were probed by
 * visitors.
 *
 * Responses are `private, no-store`: they are per-session and must never land
 * in a shared cache.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession, isCrossOrigin } from "@/lib/auth/session";
import { getAdapter } from "@/lib/content";
import type { PostMeta, SiteConfig } from "@/lib/content/types";
import { parseAnalyticsQuery } from "@/lib/analytics/query";
import type { AnalyticsQuery } from "@/lib/analytics/types";
import {
  resolveAnalyticsConfig,
  siteTimezone,
  type ResolvedAnalytics,
} from "@/lib/analytics/resolve";
import { getSiteConfig } from "@/lib/site-config";

export { siteTimezone };

/** No shared caching: these responses are per-session reporting data. */
export function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Reject cross-origin writes, then require a session.
 *
 * Order matters and matches the rest of the admin API: a forged cross-site
 * request is refused before it can touch anything, and an unauthenticated
 * caller learns nothing about whether their origin was acceptable.
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (isCrossOrigin(request)) {
    return jsonResponse({ error: "Cross-origin request blocked." }, 403);
  }
  if (!(await getSession())) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  return null;
}

export interface AnalyticsContext {
  config: SiteConfig;
  resolved: ResolvedAnalytics;
  timezone: string;
}

export async function loadAnalyticsContext(): Promise<AnalyticsContext> {
  const config = await getSiteConfig();
  return {
    config,
    resolved: resolveAnalyticsConfig(config),
    timezone: siteTimezone(),
  };
}


/**
 * Published + draft metadata for path mapping.
 *
 * A listing failure must not fail the report: the provider rows still render,
 * just without titles or edit links. Analytics is optional, and it is never
 * allowed to turn a transient content-store error into a dashboard outage.
 */
export async function loadPostsForMapping(): Promise<PostMeta[]> {
  try {
    return await getAdapter().listPosts();
  } catch (err) {
    console.warn("[analytics] post listing unavailable for path mapping:", err);
    return [];
  }
}

export type ParsedQuery =
  | { ok: true; query: AnalyticsQuery }
  | { ok: false; response: NextResponse };

/** Parse and bound the report query, or return the 400 to send. */
export function parseQuery(request: NextRequest, timezone: string): ParsedQuery {
  const parsed = parseAnalyticsQuery(new URL(request.url).searchParams, { timezone });
  if (!parsed.ok) {
    return { ok: false, response: jsonResponse({ error: parsed.error }, 400) };
  }
  return { ok: true, query: parsed.query };
}

/** The response body used when reporting is not available at all. */
export function setupState(resolved: ResolvedAnalytics, timezone: string) {
  return {
    configured: false as const,
    tracking: resolved.tracking,
    reporting: false as const,
    provider: resolved.provider,
    missing: resolved.missing,
    timezone,
  };
}
