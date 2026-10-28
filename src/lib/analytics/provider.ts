/**
 * The analytics provider boundary.
 *
 * Deliberately narrower than the PRD sketch in one place: `getTopPages` returns
 * ranked rows, not `AnalyticsPageRow`. A provider cannot know which slugs are
 * published — that is the content model's job — so the path→post mapping lives
 * in `paths.ts` and runs after the provider returns. Keeping that seam means a
 * new provider can never accidentally invent a published post.
 *
 * `null` from the factory is the normal "not configured" state, not an error.
 */
import type { SiteConfig } from "@/lib/content/types";
import { UmamiProvider } from "./providers/umami";
import { resolveAnalyticsConfig, type ResolvedAnalytics } from "./resolve";
import type {
  AnalyticsCapabilities,
  AnalyticsOverview,
  AnalyticsPagePerformance,
  AnalyticsProviderHealth,
  AnalyticsQuery,
  AnalyticsRankedRow,
} from "./types";

export interface AnalyticsProvider {
  readonly name: string;
  getCapabilities(): Promise<AnalyticsCapabilities>;
  getOverview(query: AnalyticsQuery): Promise<AnalyticsOverview>;
  getTopPages(query: AnalyticsQuery, options?: { limit?: number }): Promise<AnalyticsRankedRow[]>;
  getSources(query: AnalyticsQuery): Promise<AnalyticsRankedRow[]>;
  getCampaigns(query: AnalyticsQuery): Promise<AnalyticsRankedRow[]>;
  getPagePerformance(path: string, query: AnalyticsQuery): Promise<AnalyticsPagePerformance>;
  healthCheck(): Promise<AnalyticsProviderHealth>;
}

/**
 * Build a provider from resolved configuration, or null when reporting is not
 * possible (disabled, incomplete, or missing the server-side key).
 */
export function getAnalyticsProvider(
  resolved: ResolvedAnalytics,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): AnalyticsProvider | null {
  if (!resolved.reporting || !resolved.apiBase || !resolved.apiKey) return null;
  if (resolved.provider === "umami") {
    return new UmamiProvider({
      apiBase: resolved.apiBase,
      websiteId: resolved.websiteId,
      apiKey: resolved.apiKey,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    });
  }
  return null;
}

/** Convenience for routes: resolve config and build the provider in one step. */
export function providerFromConfig(
  config: Pick<SiteConfig, "analytics">,
  options: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): { resolved: ResolvedAnalytics; provider: AnalyticsProvider | null } {
  const resolved = resolveAnalyticsConfig(config, options.env ?? process.env);
  return {
    resolved,
    provider: getAnalyticsProvider(resolved, {
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    }),
  };
}
