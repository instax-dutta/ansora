/**
 * Report payloads shared by the analytics admin API and the admin UI.
 *
 * These exist so the client cannot guess at a field name. The UI imports them,
 * the routes are written to match, and a rename shows up as a type error rather
 * than as an empty table in production.
 */
import type { Opportunity } from "./opportunities";
import type {
  AnalyticsFailure,
  AnalyticsOverview,
  AnalyticsPagePerformance,
  AnalyticsPageRow,
  AnalyticsProviderHealth,
  AnalyticsQuery,
  AnalyticsRankedRow,
} from "./types";

/** The state every analytics response carries, configured or not. */
export interface AnalyticsStatus {
  configured: boolean;
  /** A tracker will be emitted on public pages. */
  tracking: boolean;
  /** Reports can be read server-side (also requires the API key). */
  reporting: boolean;
  provider: string;
  /** Plain-language list of what is still missing. */
  missing: string[];
  timezone: string;
}

export interface OverviewResponse extends AnalyticsStatus {
  query: AnalyticsQuery;
  overview: AnalyticsOverview | null;
  degraded: AnalyticsFailure | null;
}

export interface PagesResponse extends AnalyticsStatus {
  query: AnalyticsQuery;
  rows: AnalyticsPageRow[];
  total: number;
  /** Referrer/source rows for the same window. Direct traffic is explicit. */
  sources: AnalyticsRankedRow[];
  previousPeriod: { from: string; to: string } | null;
  /**
   * Content opportunities derived from these rows.
   *
   * Computed server-side because they need post metadata (publish date,
   * `seo.noIndex`) that the client never receives — the same `buildOpportunities`
   * rules also power the per-post panel, so one post cannot be "rising" in one
   * place and something else in another.
   */
  opportunities: Opportunity[];
  degraded: AnalyticsFailure | null;
}

/** Content context shown beside a post's traffic. */
export interface PostContext {
  slug: string;
  title: string;
  published: boolean;
  noIndex: boolean;
  indexable: boolean;
  tags: string[];
  date: string;
  updated: string | null;
  updatedReason: string;
  url: string;
  editHref: string;
  /** `null` when the body could not be read. */
  readingMinutes: number | null;
}

export interface PostPerformanceResponse extends AnalyticsStatus {
  query: AnalyticsQuery;
  path: string;
  post: PostContext;
  performance: AnalyticsPagePerformance | null;
  opportunities: Opportunity[];
  degraded: AnalyticsFailure | null;
}

export interface HealthResponse extends AnalyticsStatus {
  /** Reporting API base, or null. Never a credential. */
  apiBase: string | null;
  trackerOrigin: string | null;
  /** False when the deployment's CSP would block the tracker script. */
  cspAllowsTracker: boolean;
  health: AnalyticsProviderHealth | null;
}

export interface VerifyResponse {
  ok: boolean;
  error: AnalyticsFailure | null;
  health: AnalyticsProviderHealth | null;
}

/** Public analytics settings, as returned after a save. */
export interface AnalyticsSettingsState {
  provider: string;
  enabled: boolean;
  websiteId: string;
  baseUrl: string;
  reportBaseUrl: string;
  tracking: boolean;
  reporting: boolean;
  missing: string[];
  scriptUrl: string;
  apiBase: string | null;
  trackerOrigin: string | null;
  cspAllowsTracker: boolean;
}

export interface ConfigResponse {
  ok: boolean;
  analytics: AnalyticsSettingsState;
}
