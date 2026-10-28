/**
 * Umami adapter.
 *
 * Pinned to the documented Umami v2 API:
 *   GET {base}/api/websites/{websiteId}/stats      — totals + comparison
 *   GET {base}/api/websites/{websiteId}/pageviews  — pageviews/sessions series
 *   GET {base}/api/websites/{websiteId}/metrics    — ranked dimension rows
 *   Authorization: Bearer <api key or instance token>
 *
 * `base` is either a self-hosted instance (Umami appends `/api`) or Umami
 * Cloud, whose API key is used the same way against `https://api.umami.is/v1`.
 *
 * Failure policy, chosen to protect a rate-limited API:
 * - 401/403 are credential problems: never retried.
 * - 4xx other than 429 are our bug: never retried.
 * - 429 and 5xx are transient: retried exactly once.
 * - every request has a hard timeout, so a hanging provider cannot hold a
 *   dashboard request open.
 */
import { AnalyticsError } from "../errors";
import {
  isRecord,
  normaliseRankedRows,
  normaliseStats,
  normaliseTrend,
  percentChange,
} from "../normalise";
import type { AnalyticsProvider } from "../provider";
import type {
  AnalyticsCapabilities,
  AnalyticsOverview,
  AnalyticsPagePerformance,
  AnalyticsProviderHealth,
  AnalyticsQuery,
  AnalyticsRankedRow,
  AnalyticsTotals,
  Granularity,
} from "../types";

const CAPABILITIES: AnalyticsCapabilities = {
  visitors: true,
  visits: true,
  bounces: true,
  trend: true,
  sources: true,
  campaigns: true,
  // `type=entry` combined with a `path` filter reports the entry pages of
  // visits that touched the path — a different question than "visits that
  // landed on this post". Rather than mislabel it, the card is omitted.
  entryPages: false,
  hourlyGranularity: true,
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRY_DELAY_MS = 250;

export interface UmamiOptions {
  /** Reporting API base, e.g. `https://analytics.example.com/api`. */
  apiBase: string;
  websiteId: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
  /** Injectable clock, for measuring latency in tests. */
  now?: () => number;
}

export class UmamiProvider implements AnalyticsProvider {
  readonly name = "umami";

  private readonly apiBase: string;
  private readonly websiteId: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly now: () => number;

  constructor(options: UmamiOptions) {
    this.apiBase = options.apiBase.replace(/\/+$/, "");
    this.websiteId = options.websiteId;
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.now = options.now ?? Date.now;
  }

  async getCapabilities(): Promise<AnalyticsCapabilities> {
    return { ...CAPABILITIES };
  }

  async getOverview(query: AnalyticsQuery): Promise<AnalyticsOverview> {
    const [statsPayload, seriesPayload] = await Promise.all([
      this.request(`/websites/${this.websitePath()}/stats`, this.statParams(query)),
      this.request(`/websites/${this.websitePath()}/pageviews`, {
        ...this.rangeParams(query),
        unit: unitFor(query.granularity),
        ...(query.compareToPreviousPeriod ? { compare: "prev" } : {}),
      }),
    ]);

    const stats = normaliseStats(statsPayload);
    const comparison =
      isRecord(statsPayload) && isRecord(statsPayload.comparison)
        ? statsPayload.comparison
        : null;

    return {
      pageviews: stats.pageviews,
      visitors: stats.visitors,
      visits: stats.visits,
      bounces: stats.bounces,
      engagementRate: stats.engagementRate,
      averageVisitDurationSeconds: stats.averageVisitDurationSeconds,
      trend: normaliseTrend(seriesPayload, query.granularity),
      previousPeriod: comparison ? totalsFrom(comparison) : null,
      provider: this.name,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getTopPages(
    query: AnalyticsQuery,
    options: { limit?: number } = {}
  ): Promise<AnalyticsRankedRow[]> {
    const payload = await this.request(`/websites/${this.websitePath()}/metrics`, {
      ...this.rangeParams(query),
      type: "path",
      limit: boundedLimit(options.limit),
    });
    return normaliseRankedRows(payload);
  }

  async getSources(query: AnalyticsQuery): Promise<AnalyticsRankedRow[]> {
    const payload = await this.request(`/websites/${this.websitePath()}/metrics`, {
      ...this.rangeParams(query),
      type: "referrer",
      limit: DEFAULT_LIMIT,
    });
    return normaliseRankedRows(payload, { nullLabel: "Direct / unknown" });
  }

  async getCampaigns(query: AnalyticsQuery): Promise<AnalyticsRankedRow[]> {
    const payload = await this.request(`/websites/${this.websitePath()}/metrics`, {
      ...this.rangeParams(query),
      type: "utmCampaign",
      limit: DEFAULT_LIMIT,
    });
    return normaliseRankedRows(payload, { nullLabel: "No campaign" });
  }

  async getPagePerformance(
    path: string,
    query: AnalyticsQuery
  ): Promise<AnalyticsPagePerformance> {
    const scoped = { ...this.rangeParams(query), path };
    const [seriesPayload, statsPayload, sourcesPayload, campaignsPayload] = await Promise.all([
      this.request(`/websites/${this.websitePath()}/pageviews`, {
        ...scoped,
        unit: unitFor(query.granularity),
        ...(query.compareToPreviousPeriod ? { compare: "prev" } : {}),
      }),
      this.request(`/websites/${this.websitePath()}/stats`, {
        ...scoped,
        ...(query.compareToPreviousPeriod ? { compare: "prev" } : {}),
      }),
      this.request(`/websites/${this.websitePath()}/metrics`, {
        ...scoped,
        type: "referrer",
        limit: DEFAULT_LIMIT,
      }),
      this.request(`/websites/${this.websitePath()}/metrics`, {
        ...scoped,
        type: "utmCampaign",
        limit: DEFAULT_LIMIT,
      }),
    ]);

    const stats = normaliseStats(statsPayload);
    const seriesComparison = isRecord(seriesPayload) ? seriesPayload.compare : undefined;
    const previousFromSeries = sumSeries(
      isRecord(seriesComparison) ? seriesComparison.pageviews : undefined
    );
    const previousFromStats =
      isRecord(statsPayload) && isRecord(statsPayload.comparison)
        ? normaliseStats(statsPayload.comparison).pageviews
        : null;
    const previousPageviews = previousFromSeries ?? previousFromStats;

    return {
      path,
      trend: normaliseTrend(seriesPayload, query.granularity),
      fetchedAt: new Date().toISOString(),
      pageviews: stats.pageviews,
      previousPageviews,
      change: percentChange(stats.pageviews, previousPageviews),
      visits: stats.visits,
      sources: normaliseRankedRows(sourcesPayload, { nullLabel: "Direct / unknown" }),
      campaigns: normaliseRankedRows(campaignsPayload, { nullLabel: "No campaign" }),
    };
  }

  async healthCheck(): Promise<AnalyticsProviderHealth> {
    const startedAt = this.now();
    try {
      await this.request(`/websites/${this.websitePath()}`, {});
      return {
        ok: true,
        provider: this.name,
        checkedAt: new Date().toISOString(),
        latencyMs: Math.max(0, this.now() - startedAt),
        error: null,
      };
    } catch (err) {
      const failure =
        err instanceof AnalyticsError ? err : null;
      return {
        ok: false,
        provider: this.name,
        checkedAt: new Date().toISOString(),
        latencyMs: null,
        error: failure
          ? failure.toFailure()
          : {
              code: "unreachable",
              message: "The analytics provider could not be reached.",
            },
      };
    }
  }

  /* ----------------------------- internals ------------------------------- */

  private websitePath(): string {
    // Percent-encoded so a hostile website id cannot escape the path.
    return encodeURIComponent(this.websiteId);
  }

  private rangeParams(query: AnalyticsQuery): Record<string, string> {
    return {
      startDate: query.from,
      endDate: query.to,
      timezone: query.timezone,
    };
  }

  private statParams(query: AnalyticsQuery): Record<string, string> {
    return {
      ...this.rangeParams(query),
      ...(query.compareToPreviousPeriod ? { compare: "prev" } : {}),
    };
  }

  /**
   * One provider call, with a hard timeout and at most one retry.
   *
   * The response body is parsed defensively: a proxy error page served with a
   * 200 must not become an unhandled exception deep in the dashboard.
   */
  private async request(
    path: string,
    params: Record<string, string | number>
  ): Promise<unknown> {
    const url = new URL(`${this.apiBase}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    let lastError: AnalyticsError | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0 && this.retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            authorization: `Bearer ${this.apiKey}`,
            accept: "application/json",
          },
          signal: controller.signal,
          cache: "no-store",
        });

        if (response.ok) {
          const text = await response.text();
          try {
            return JSON.parse(text) as unknown;
          } catch {
            throw new AnalyticsError(
              "bad_response",
              "The analytics provider returned a response that could not be read."
            );
          }
        }

        if (response.status === 401 || response.status === 403) {
          throw new AnalyticsError(
            "unauthorized",
            `The analytics provider rejected the credentials (HTTP ${response.status}). Check ANALYTICS_API_KEY.`,
            response.status
          );
        }
        if (response.status === 429) {
          lastError = new AnalyticsError(
            "rate_limited",
            "The analytics provider is rate limiting requests. Try again shortly.",
            429
          );
          continue;
        }
        if (response.status >= 500) {
          lastError = new AnalyticsError(
            "server_error",
            `The analytics provider returned an error (HTTP ${response.status}).`,
            response.status
          );
          continue;
        }
        throw new AnalyticsError(
          "bad_response",
          `The analytics provider rejected the request (HTTP ${response.status}).`,
          response.status
        );
      } catch (err) {
        if (err instanceof AnalyticsError) {
          // Credential and request-shape errors are not transient.
          if (err.code !== "rate_limited" && err.code !== "server_error") throw err;
          lastError = err;
          continue;
        }
        const aborted =
          controller.signal.aborted ||
          (typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError");
        lastError = aborted
          ? new AnalyticsError(
              "timeout",
              `The analytics provider did not respond within ${Math.round(this.timeoutMs / 1000)}s.`
            )
          : new AnalyticsError(
              "unreachable",
              "The analytics provider could not be reached."
            );
        continue;
      } finally {
        clearTimeout(timer);
      }
    }

    throw (
      lastError ??
      new AnalyticsError("unreachable", "The analytics provider could not be reached.")
    );
  }
}

function unitFor(granularity: Granularity): string {
  return granularity === "hour" ? "hour" : "day";
}

function boundedLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

function totalsFrom(payload: Record<string, unknown>): AnalyticsTotals {
  const stats = normaliseStats(payload);
  return {
    pageviews: stats.pageviews,
    visitors: stats.visitors,
    visits: stats.visits,
  };
}

function sumSeries(points: unknown): number | null {
  if (!Array.isArray(points)) return null;
  let total = 0;
  let seen = false;
  for (const point of points) {
    if (!isRecord(point)) continue;
    if (typeof point.y !== "number" || !Number.isFinite(point.y)) continue;
    total += point.y;
    seen = true;
  }
  return seen ? total : null;
}
