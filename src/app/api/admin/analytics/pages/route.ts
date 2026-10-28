import { NextRequest } from "next/server";
import { analyticsCacheKey, cachedAnalytics } from "@/lib/analytics/cache";
import { toCsv } from "@/lib/analytics/csv";
import { toAnalyticsError } from "@/lib/analytics/errors";
import { buildOpportunities } from "@/lib/analytics/opportunities";
import { mapPageRowsToPosts, withPageChange } from "@/lib/analytics/paths";
import { getAnalyticsProvider } from "@/lib/analytics/provider";
import { previousPeriod } from "@/lib/analytics/query";
import type { AnalyticsPageRow, AnalyticsQuery, AnalyticsRankedRow } from "@/lib/analytics/types";
import {
  jsonResponse,
  loadAnalyticsContext,
  loadPostsForMapping,
  parseQuery,
  requireAdmin,
  setupState,
} from "../_shared";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const PREVIOUS_LIMIT = 100;

/** Bounded row count — this table is never an unbounded provider query. */
function limitFrom(request: NextRequest): number {
  const raw = new URL(request.url).searchParams.get("limit");
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

/**
 * Top content, mapped to published posts.
 *
 * The provider only knows paths; the content model knows what is published. The
 * mapping happens here so a draft slug can never be presented as a post, and
 * `change` is computed from an equal-length previous window (one extra bounded
 * provider call, cached separately).
 *
 * `?format=csv` returns the same rows as a sanitised spreadsheet export.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { config, resolved, timezone } = await loadAnalyticsContext();
  const parsed = parseQuery(request, timezone);
  if (!parsed.ok) return parsed.response;
  const query = parsed.query;
  const limit = limitFrom(request);
  const format = new URL(request.url).searchParams.get("format") ?? "json";

  if (!resolved.reporting) {
    return jsonResponse({
      ...setupState(resolved, timezone),
      query,
      rows: [],
      total: 0,
      sources: [],
      previousPeriod: null,
      opportunities: [],
      degraded: null,
    });
  }

  const provider = getAnalyticsProvider(resolved);
  if (!provider) {
    return jsonResponse({
      ...setupState(resolved, timezone),
      query,
      rows: [],
      total: 0,
      sources: [],
      previousPeriod: null,
      opportunities: [],
      degraded: { code: "unconfigured", message: "No analytics provider is available." },
    });
  }

  const previousWindow = previousPeriod(query.from, query.to);
  const previousQuery: AnalyticsQuery = {
    ...query,
    from: previousWindow.from,
    to: previousWindow.to,
    compareToPreviousPeriod: false,
  };

  try {
    const [current, previous, sources] = await Promise.all([
      cachedAnalytics(
        analyticsCacheKey({
          kind: "pages",
          provider: resolved.provider,
          websiteId: resolved.websiteId,
          from: query.from,
          to: query.to,
          timezone: query.timezone,
          limit,
        }),
        () => provider.getTopPages(query, { limit })
      ),
      query.compareToPreviousPeriod
        ? cachedAnalytics(
            analyticsCacheKey({
              kind: "pages-previous",
              provider: resolved.provider,
              websiteId: resolved.websiteId,
              from: previousQuery.from,
              to: previousQuery.to,
              timezone: query.timezone,
              limit: PREVIOUS_LIMIT,
            }),
            () => provider.getTopPages(previousQuery, { limit: PREVIOUS_LIMIT })
          )
        : Promise.resolve([] as AnalyticsRankedRow[]),
      cachedAnalytics(
        analyticsCacheKey({
          kind: "sources",
          provider: resolved.provider,
          websiteId: resolved.websiteId,
          from: query.from,
          to: query.to,
          timezone: query.timezone,
        }),
        () => provider.getSources(query)
      ),
    ]);

    const posts = await loadPostsForMapping();
    const rows: AnalyticsPageRow[] = withPageChange(
      mapPageRowsToPosts(
        current.map((row) => ({ path: row.key, pageviews: row.pageviews })),
        posts,
        config.baseUrl
      ),
      previous.map((row) => ({ path: row.key, pageviews: row.pageviews })),
      config.baseUrl
    );

    if (format === "csv") {
      return csvResponse(rows, query, config.baseUrl);
    }

    return jsonResponse({
      configured: true,
      tracking: resolved.tracking,
      reporting: true,
      provider: resolved.provider,
      missing: resolved.missing,
      timezone,
      query,
      rows,
      total: rows.length,
      sources,
      previousPeriod: query.compareToPreviousPeriod ? previousWindow : null,
      opportunities: buildOpportunities({ rows, posts }),
      degraded: null,
    });
  } catch (err) {
    const failure = toAnalyticsError(err);
    console.warn(`[analytics] top pages unavailable (${failure.code}): ${failure.message}`);
    return jsonResponse({
      configured: true,
      tracking: resolved.tracking,
      reporting: true,
      provider: resolved.provider,
      missing: resolved.missing,
      timezone,
      query,
      rows: [],
      total: 0,
      sources: [],
      previousPeriod: null,
      opportunities: [],
      degraded: failure.toFailure(),
    });
  }
}

function csvResponse(rows: AnalyticsPageRow[], query: AnalyticsQuery, baseUrl: string) {
  const body = toCsv(
    ["Post", "Path", "Views", "Visitors", "Change %", "Last updated", "URL"],
    rows.map((row) => [
      row.post?.title ?? "",
      row.path,
      row.pageviews,
      row.visitors,
      row.change,
      row.post?.updated ?? "",
      `${baseUrl.replace(/\/+$/, "")}${row.path}`,
    ])
  );

  return new Response(`\uFEFF${body}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ansora-analytics-pages-${query.from}-to-${query.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
