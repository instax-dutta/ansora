"use client";

import { useEffect, useMemo, useState } from "react";
import type { OverviewResponse, PagesResponse } from "@/lib/analytics/reports";
import { DEFAULT_RANGE_DAYS, addDays, todayInZone } from "@/lib/analytics/query";
import { AnalyticsOverviewCards, OverviewSkeleton } from "./AnalyticsOverview";
import { DateRangePicker, type DateRange } from "./DateRangePicker";
import { OpportunityList } from "./OpportunityList";
import { SourceBreakdown } from "./SourceBreakdown";
import { TopContentTable } from "./TopContentTable";

interface Loaded {
  /** The query string these reports answer. Stale results stay on screen. */
  query: string;
  overview: OverviewResponse | null;
  pages: PagesResponse | null;
  notice: string;
}

/**
 * The Analytics page.
 *
 * Four states, all of them real: loading (skeleton, never a zero-valued chart),
 * data, provider-unavailable (keep the last good numbers on screen and say they
 * could not be refreshed), and not configured (handled by the page, which
 * renders the setup card instead).
 *
 * `loading` is *derived* from whether the loaded result answers the current
 * query, rather than being a flag set inside the effect. That removes a class of
 * bug where a stale flag hides fresh data, and it keeps the effect purely about
 * talking to the network.
 *
 * The two report requests are issued together and each is independently
 * cacheable server-side, so opening this page costs the provider a bounded
 * number of calls — never one per post.
 */
export function AnalyticsDashboard({ timezone }: { timezone: string }) {
  const defaultRange: DateRange = useMemo(() => {
    const to = todayInZone(timezone);
    return { days: DEFAULT_RANGE_DAYS, from: addDays(to, -(DEFAULT_RANGE_DAYS - 1)), to };
  }, [timezone]);

  const [range, setRange] = useState<DateRange>(defaultRange);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Loaded | null>(null);

  const query = useMemo(() => {
    const search = new URLSearchParams({ timezone });
    if (range.days !== null) search.set("days", String(range.days));
    else {
      search.set("from", range.from);
      search.set("to", range.to);
    }
    return search.toString();
  }, [range, timezone]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [overviewRes, pagesRes] = await Promise.all([
          fetch(`/api/admin/analytics/overview?${query}`),
          fetch(`/api/admin/analytics/pages?${query}`),
        ]);
        const overviewBody = (await overviewRes.json()) as OverviewResponse;
        const pagesBody = (await pagesRes.json()) as PagesResponse;
        if (cancelled) return;

        if (!overviewBody.configured && !pagesBody.configured) {
          setResult({
            query,
            overview: null,
            pages: null,
            notice: "Analytics is not fully configured yet, so there are no numbers to show.",
          });
          return;
        }

        // Keep the last successful report visible and say why it is stale: a
        // transient provider failure must never look like "nobody reads you".
        const failure = overviewBody.degraded ?? pagesBody.degraded;
        setResult((previous) => ({
          query,
          overview: overviewBody.overview ? overviewBody : (previous?.overview ?? null),
          pages: pagesBody.degraded ? (previous?.pages ?? null) : pagesBody,
          notice: failure ? `Could not refresh from the provider: ${failure.message}` : "",
        }));
      } catch {
        if (!cancelled) {
          setResult((previous) => ({
            query,
            overview: previous?.overview ?? null,
            pages: previous?.pages ?? null,
            notice: "Could not reach the analytics API. Your blog is unaffected.",
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query, nonce]);

  const loading = result?.query !== query;
  const overview = result?.overview ?? null;
  const pages = result?.pages ?? null;
  const notice = loading ? "" : (result?.notice ?? "");
  const csvHref = `/api/admin/analytics/pages?${query}&format=csv`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <DateRangePicker value={range} timezone={timezone} onChange={setRange} />
        {(notice || loading) && (
          <button
            type="button"
            onClick={() => setNonce((value) => value + 1)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            Retry
          </button>
        )}
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-line bg-surface-soft px-3 py-2 text-sm text-ink-muted">
          {notice}
        </p>
      )}

      {loading && !overview ? (
        <OverviewSkeleton />
      ) : overview?.overview ? (
        <AnalyticsOverviewCards overview={overview.overview} timezone={timezone} />
      ) : null}

      {pages && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <TopContentTable
            rows={pages.rows}
            csvHref={csvHref}
            hasComparison={pages.previousPeriod !== null}
          />
          <div className="space-y-6">
            <OpportunityList opportunities={pages.opportunities} />
            <SourceBreakdown sources={pages.sources} />
            <section
              aria-label="Report details"
              className="rounded-2xl border border-line bg-surface p-5 text-xs leading-relaxed text-ink-muted"
            >
              <h2 className="font-serif text-base font-semibold text-ink">
                About these numbers
              </h2>
              <p className="mt-2">
                Timezone: {pages.timezone}. Provider: {pages.provider}. Values
                come from your analytics service, are cached for a couple of
                minutes, and are estimates — bot filtering, ad blockers and
                privacy settings all affect them.
              </p>
              <p className="mt-2">
                Unique visitors use the provider&apos;s own definition, and a
                metric the provider does not report is shown as “—” rather than
                zero.
              </p>
            </section>
          </div>
        </div>
      )}

      {!loading && !notice && !overview?.overview && !pages && (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">
          No analytics data for this period.
        </p>
      )}
    </div>
  );
}
