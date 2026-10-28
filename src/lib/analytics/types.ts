/**
 * Provider-neutral analytics types.
 *
 * The rule that shapes this file: a metric the provider cannot report is
 * `null`, never `0`. "We do not measure this" and "nobody engaged" are
 * different facts, and displaying the second when you mean the first is how an
 * author concludes their blog is dead.
 */

/** Bucketing unit. `week` is deliberately absent: no supported provider reports it. */
export type Granularity = "hour" | "day";

export interface AnalyticsQuery {
  /** Inclusive `YYYY-MM-DD` in `timezone`. */
  from: string;
  /** Inclusive `YYYY-MM-DD` in `timezone`. */
  to: string;
  /** IANA timezone, e.g. `Asia/Kolkata`. */
  timezone: string;
  granularity: Granularity;
  compareToPreviousPeriod: boolean;
  /** Normalised site pathname only — never an origin, query string or hash. */
  path?: string;
}

/**
 * What this provider can actually report. The dashboard renders from this, so
 * an unsupported card disappears instead of showing a fabricated zero.
 */
export interface AnalyticsCapabilities {
  visitors: boolean;
  visits: boolean;
  bounces: boolean;
  trend: boolean;
  sources: boolean;
  campaigns: boolean;
  /** Entry-page sessions. Only true when the provider distinguishes them. */
  entryPages: boolean;
  hourlyGranularity: boolean;
}

export interface TrendPoint {
  /** `YYYY-MM-DD`, or `YYYY-MM-DDTHH` for hourly granularity. */
  date: string;
  pageviews: number;
  /** Per-bucket unique visitors; null when the provider does not report it. */
  visitors: number | null;
}

export interface AnalyticsTotals {
  pageviews: number | null;
  visitors: number | null;
  visits: number | null;
}

export interface AnalyticsOverview extends AnalyticsTotals {
  bounces: number | null;
  /**
   * Share of visits that produced more than one pageview, derived from the
   * provider's own `visits`/`bounces` definitions. Labelled as such in the UI;
   * not a universal "bounce rate".
   */
  engagementRate: number | null;
  averageVisitDurationSeconds: number | null;
  trend: TrendPoint[];
  previousPeriod: AnalyticsTotals | null;
  provider: string;
  /** ISO timestamp of the provider response, so stale data is visible. */
  fetchedAt: string;
}

export type PageKind = "home" | "blog" | "post" | "tag" | "about" | "other";

/** The published post a page path resolves to. Never a draft. */
export interface PagePostRef {
  slug: string;
  title: string;
  noIndex: boolean;
  updated: string | null;
}

export interface AnalyticsPageRow {
  path: string;
  pageviews: number;
  visitors: number | null;
  /** Percent change vs the previous period; null when there is no baseline. */
  change: number | null;
  kind: PageKind;
  post: PagePostRef | null;
}

/** A provider's ranked dimension row (referrer, campaign, …). */
export interface AnalyticsRankedRow {
  key: string;
  pageviews: number;
}

export interface AnalyticsPagePerformance {
  path: string;
  trend: TrendPoint[];
  /** ISO timestamp of the provider response, so staleness is visible. */
  fetchedAt: string;
  pageviews: number | null;
  previousPageviews: number | null;
  change: number | null;
  visits: number | null;
  sources: AnalyticsRankedRow[];
  campaigns: AnalyticsRankedRow[];
}

export type AnalyticsErrorCode =
  | "unconfigured"
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "unreachable"
  | "server_error"
  | "bad_response";

/** A safe, renderable failure. Never carries a credential or a raw body. */
export interface AnalyticsFailure {
  code: AnalyticsErrorCode;
  message: string;
}

export interface AnalyticsProviderHealth {
  ok: boolean;
  provider: string;
  checkedAt: string;
  latencyMs: number | null;
  error: AnalyticsFailure | null;
}
