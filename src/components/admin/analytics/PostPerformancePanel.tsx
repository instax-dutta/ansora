"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PostPerformanceResponse } from "@/lib/analytics/reports";
import { DEFAULT_RANGE_DAYS } from "@/lib/analytics/query";
import { OpportunityList } from "./OpportunityList";
import { SourceBreakdown } from "./SourceBreakdown";
import { TrendChart } from "./TrendChart";
import { OverviewSkeleton } from "./AnalyticsOverview";
import { changeDisplay, formatFetchedAt, formatMetric } from "./format";

interface Loaded {
  /** The day-range these numbers answer; stale results stay on screen. */
  key: string;
  data: PostPerformanceResponse | null;
  notice: string;
}

/**
 * One post's report.
 *
 * Search visibility (impressions, queries, CTR) is deliberately absent: that
 * data lives in Search Console, not in web analytics, and inventing a proxy for
 * it would be the most misleading thing this page could do. What is here —
 * trend, referrers, campaigns, content context — is measured.
 *
 * `loading` is derived from whether the loaded report answers the selected
 * range, so a slow request cannot hide the numbers already on screen.
 */
export function PostPerformancePanel({
  slug,
  timezone,
  defaults,
}: {
  slug: string;
  timezone: string;
  /** Server-rendered content context, available before the report loads. */
  defaults: PostPerformanceResponse["post"];
}) {
  const [days, setDays] = useState(DEFAULT_RANGE_DAYS);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Loaded | null>(null);

  const key = useMemo(() => `days=${days}&timezone=${timezone}`, [days, timezone]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/admin/analytics/posts/${encodeURIComponent(slug)}?${key}`
        );
        const body = (await res.json()) as PostPerformanceResponse;
        if (cancelled) return;
        setResult((previous) => ({
          key,
          // A degraded response keeps the report we already had on screen.
          data: body.degraded ? (previous?.data ?? null) : body,
          notice: body.degraded
            ? `Could not refresh from the provider: ${body.degraded.message}`
            : "",
        }));
      } catch {
        if (!cancelled) {
          setResult((previous) => ({
            key,
            data: previous?.data ?? null,
            notice: "Could not reach the analytics API. Your blog is unaffected.",
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, slug, nonce]);

  const loading = result?.key !== key;
  const data = result?.data ?? null;
  const notice = loading ? "" : (result?.notice ?? "");
  const post = data?.post ?? defaults;
  const performance = data?.performance ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink">
              {post.title}
            </h1>
            <p className="mt-1 font-mono text-xs text-ink-muted">{post.url}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand-strong">
                {post.published ? "Published" : "Draft"}
              </span>
              {post.noIndex && (
                <span className="rounded-full bg-surface-soft px-2 py-0.5 text-ink-muted">
                  no-index: kept out of search and feeds
                </span>
              )}
              <span className="text-ink-muted">
                Published {post.date.slice(0, 10)}
                {post.updated ? ` · updated ${post.updated.slice(0, 10)}` : ""}
              </span>
              {post.readingMinutes !== null && (
                <span className="text-ink-muted">
                  · ~{post.readingMinutes} min read (estimated)
                </span>
              )}
            </div>
            {post.tags.length > 0 && (
              <p className="mt-2 text-xs text-ink-muted">Tags: {post.tags.join(", ")}</p>
            )}
            {post.updatedReason && (
              <p className="mt-1 text-xs text-ink-muted">Last update: {post.updatedReason}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={post.editHref}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
            >
              Edit post
            </Link>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
            >
              View post
            </a>
            <Link
              href="/admin/analytics"
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              All analytics
            </Link>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={days === value}
            onClick={() => setDays(value)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              days === value
                ? "border-brand bg-brand-soft text-brand-strong"
                : "border-line text-ink-muted hover:text-ink"
            }`}
          >
            {value} days
          </button>
        ))}
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

      {loading && !performance ? (
        <OverviewSkeleton />
      ) : performance ? (
        <>
          <section aria-label="Post totals" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Metric
              label="Pageviews"
              value={performance.pageviews}
              detail={
                performance.previousPageviews === null
                  ? "no prior period to compare"
                  : `previous period: ${formatMetric(performance.previousPageviews)}`
              }
            />
            <Metric
              label="Visits"
              value={performance.visits}
              detail="provider-defined sessions"
            />
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-sm text-ink-muted">Change</p>
              <p className="mt-1 font-serif text-3xl font-semibold text-ink">
                {changeDisplay(performance.change).label}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {changeDisplay(performance.change).description}
              </p>
            </div>
          </section>

          <section
            aria-label="Pageview trend"
            className="rounded-2xl border border-line bg-surface p-5"
          >
            <h2 className="font-serif text-lg font-semibold text-ink">Traffic for this post</h2>
            <div className="mt-4">
              <TrendChart points={performance.trend} label="Pageviews for this post" />
            </div>
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
              Fetched {formatFetchedAt(performance.fetchedAt)} · timezone {timezone}
            </p>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SourceBreakdown
              sources={performance.sources}
              title="Where these readers came from"
              emptyLabel="No referrer data for this post in this period."
            />
            <SourceBreakdown
              sources={performance.campaigns}
              title="Campaigns"
              emptyLabel="No campaign parameters seen for this post in this period."
            />
          </div>

          <OpportunityList opportunities={data?.opportunities ?? []} />
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">
          No analytics data for this post yet.
        </p>
      )}

      <p className="text-xs leading-relaxed text-ink-muted">
        Search impressions, queries and click-through rate are not shown here.
        They come from Google Search Console, not from web analytics — this page
        only reports what your analytics provider actually measured.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl font-semibold text-ink">{formatMetric(value)}</p>
      <p className="mt-1 text-xs text-ink-muted">{detail}</p>
    </div>
  );
}
