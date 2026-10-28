import { NextRequest } from "next/server";
import { analyticsCacheKey, cachedAnalytics } from "@/lib/analytics/cache";
import { toAnalyticsError } from "@/lib/analytics/errors";
import { getAnalyticsProvider } from "@/lib/analytics/provider";
import {
  jsonResponse,
  loadAnalyticsContext,
  parseQuery,
  requireAdmin,
  setupState,
} from "../_shared";

export const dynamic = "force-dynamic";

/**
 * KPI totals, the daily trend and the previous-period comparison.
 *
 * Two provider calls (stats + pageviews), cached for two minutes. A provider
 * failure is a 200 with `degraded` set, not a 500: the dashboard then keeps the
 * last successful timestamp on screen and explains what happened, instead of
 * rendering a page of zeros that looks like "nobody reads your blog".
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { resolved, timezone } = await loadAnalyticsContext();
  const parsed = parseQuery(request, timezone);
  if (!parsed.ok) return parsed.response;
  const query = parsed.query;

  if (!resolved.reporting) {
    return jsonResponse({ ...setupState(resolved, timezone), query, overview: null, degraded: null });
  }

  const provider = getAnalyticsProvider(resolved);
  if (!provider) {
    return jsonResponse({
      ...setupState(resolved, timezone),
      query,
      overview: null,
      degraded: { code: "unconfigured", message: "No analytics provider is available." },
    });
  }

  const key = analyticsCacheKey({
    kind: "overview",
    provider: resolved.provider,
    websiteId: resolved.websiteId,
    from: query.from,
    to: query.to,
    timezone: query.timezone,
    granularity: query.granularity,
    compare: query.compareToPreviousPeriod,
  });

  try {
    const overview = await cachedAnalytics(key, () => provider.getOverview(query));
    return jsonResponse({
      configured: true,
      tracking: resolved.tracking,
      reporting: true,
      provider: resolved.provider,
      missing: resolved.missing,
      timezone,
      query,
      overview,
      degraded: null,
    });
  } catch (err) {
    const failure = toAnalyticsError(err);
    console.warn(`[analytics] overview unavailable (${failure.code}): ${failure.message}`);
    return jsonResponse({
      configured: true,
      tracking: resolved.tracking,
      reporting: true,
      provider: resolved.provider,
      missing: resolved.missing,
      timezone,
      query,
      overview: null,
      degraded: failure.toFailure(),
    });
  }
}
