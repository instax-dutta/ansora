"use client";

import { percentChange } from "@/lib/analytics/normalise";
import type { AnalyticsOverview } from "@/lib/analytics/types";
import { formatFetchedAt, formatMetric, isUnreported, newOrChange } from "./format";
import { TrendChart } from "./TrendChart";

interface Kpi {
  label: string;
  value: number | null;
  previous: number | null;
  /** Definition shown under the number, so the metric is never a mystery. */
  definition: string;
}

/**
 * The KPI row and trend.
 *
 * Two rules from the PRD are enforced visually here:
 * - a metric the provider cannot report shows an em dash and "not reported",
 *   never a fabricated zero;
 * - a comparison against an empty previous period reads "New", not "+∞%" or a
 *   misleading `0%`.
 */
export function AnalyticsOverviewCards({
  overview,
  timezone,
}: {
  overview: AnalyticsOverview;
  timezone: string;
}) {
  const previous = overview.previousPeriod;
  const kpis: Kpi[] = [
    {
      label: "Pageviews",
      value: overview.pageviews,
      previous: previous?.pageviews ?? null,
      definition: "Every pageview, repeat views included.",
    },
    {
      label: "Unique visitors",
      value: overview.visitors,
      previous: previous?.visitors ?? null,
      definition: "Unique visitors as counted by the provider's own deduplication window.",
    },
    {
      label: "Visits",
      value: overview.visits,
      previous: previous?.visits ?? null,
      definition: "Provider-defined sessions. Not a count of people.",
    },
    {
      label: "Visits without a bounce",
      value: overview.engagementRate,
      previous: null,
      definition:
        "Share of visits that viewed more than one page, derived from the provider's visits and bounces.",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const change = newOrChange(
            percentChange(kpi.value, kpi.previous),
            kpi.value,
            kpi.previous
          );
          const unreported = isUnreported(kpi.value);
          return (
            <div key={kpi.label} className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-sm text-ink-muted">{kpi.label}</p>
              <p className="mt-1 font-serif text-3xl font-semibold text-ink">
                {unreported ? (
                  <span title="This provider does not report this metric">—</span>
                ) : (
                  formatMetric(kpi.value)
                )}
              </p>
              {unreported ? (
                <p className="mt-1 text-xs text-ink-muted">Not reported by this provider</p>
              ) : (
                <p className="mt-1 text-xs text-ink-muted">
                  <span aria-hidden="true">{change.arrow}</span> {change.label}
                  <span className="sr-only"> {change.description}</span>
                  {previous ? " vs previous period" : ""}
                </p>
              )}
              <p className="mt-2 border-t border-line pt-2 text-xs leading-relaxed text-ink-muted">
                {kpi.definition}
              </p>
            </div>
          );
        })}
      </div>

      <section aria-label="Pageview trend" className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold text-ink">Trend</h2>
          <p className="text-xs text-ink-muted">
            Bucketed by {overview.trend.length > 1 && overview.trend[0].date.length > 10 ? "hour" : "day"} in {timezone}
          </p>
        </div>
        <div className="mt-4">
          <TrendChart points={overview.trend} label="Pageviews" />
        </div>
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
          Source: {overview.provider} · fetched {formatFetchedAt(overview.fetchedAt)}.
          Analytics are estimates, affected by bot filtering, ad blockers and
          privacy settings.
        </p>
      </section>
    </div>
  );
}

/** Shown while the first load is in flight: no fake zeros, a real skeleton. */
export function OverviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading analytics…</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl border border-line bg-surface-soft" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-2xl border border-line bg-surface-soft" />
    </div>
  );
}
