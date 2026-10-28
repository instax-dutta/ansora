import { AnalyticsDashboard } from "@/components/admin/analytics/AnalyticsDashboard";
import { AnalyticsSetupCard } from "@/components/admin/analytics/AnalyticsSetupCard";
import {
  cspAllowsTracker,
  resolveAnalyticsConfig,
  siteTimezone,
  trackerOriginOf,
} from "@/lib/analytics/resolve";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

/**
 * Admin → Analytics.
 *
 * Two states, chosen by what the deployment can actually do:
 * - nothing configured → the setup card, with an explanation of what would be
 *   collected and where it would live. No zero-valued chart pretends to be data.
 * - tracking and/or reporting available → the dashboard, with the settings
 *   panel still reachable beneath it.
 *
 * Server component: the provider credential never crosses to the browser, and
 * only booleans plus public identifiers are sent to the client bridge.
 */
export default async function AnalyticsPage() {
  const config = await getSiteConfig();
  const resolved = resolveAnalyticsConfig(config);
  const timezone = siteTimezone();

  const state = {
    provider: resolved.provider,
    enabled: resolved.enabled,
    websiteId: resolved.websiteId,
    baseUrl: resolved.baseUrl,
    reportBaseUrl: config.analytics.reportBaseUrl,
    tracking: resolved.tracking,
    reporting: resolved.reporting,
    missing: resolved.missing,
    scriptUrl: resolved.scriptUrl,
    apiBase: resolved.apiBase,
    trackerOrigin: trackerOriginOf(resolved),
    cspAllowsTracker: cspAllowsTracker(resolved, process.env),
  };

  const usable = resolved.tracking || resolved.reporting;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">
            Analytics
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            How readers find and consume your writing. Ansora stores no visitor
            data itself — this reads reports from an analytics service you
            control, and stays out of the way when it is not configured.
          </p>
        </div>
      </div>

      <div className="mt-8">
        {usable ? (
          <AnalyticsDashboard timezone={timezone} />
        ) : (
          <AnalyticsSetupCard initial={{ analytics: config.analytics, state }} />
        )}
      </div>

      {usable && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm font-medium text-ink-muted hover:text-ink">
            Analytics settings
          </summary>
          <div className="mt-4">
            <AnalyticsSetupCard initial={{ analytics: config.analytics, state }} />
          </div>
        </details>
      )}
    </div>
  );
}
