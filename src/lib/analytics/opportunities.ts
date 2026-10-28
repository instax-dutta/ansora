/**
 * "What to do next":
 *
 * Recommendations are the easiest way to turn an analytics page into a
 * horoscope. Each one here is derived from a number the same page displays, is
 * suppressed below a sample threshold, and is worded so it cannot be read as a
 * causal claim ("this post is rising", not "you should rewrite the title").
 *
 * Priority is deliberate: a no-indexed post goes first, because every other
 * observation about its search traffic needs that context to mean anything.
 */
import type { PostMeta } from "@/lib/content/types";
import { monthsSince } from "@/lib/markdown/overlap";
import type { AnalyticsPagePerformance, AnalyticsPageRow } from "./types";

export type OpportunityKind =
  | "noindex"
  | "rising"
  | "declining"
  | "unmeasured"
  | "stale";

export interface Opportunity {
  kind: OpportunityKind;
  slug: string;
  title: string;
  /** One sentence, explainable from the numbers on the page. */
  message: string;
  href: string;
}

export interface OpportunityLimits {
  /** Views required before a comparison is worth making. */
  minPageviews: number;
  /** Relative change, in percent, that counts as a move. */
  minChangePercent: number;
  /** Age at which an untouched published post is worth reviewing. */
  staleMonths: number;
  /** Age before "no data yet" is a fair statement. */
  minimumAgeDays: number;
}

export const OPPORTUNITY_DEFAULTS: OpportunityLimits = {
  minPageviews: 100,
  minChangePercent: 25,
  staleMonths: 6,
  minimumAgeDays: 14,
};

export function buildOpportunities(input: {
  rows: AnalyticsPageRow[];
  posts: PostMeta[];
  now?: number;
  limits?: Partial<OpportunityLimits>;
  maxResults?: number;
}): Opportunity[] {
  const { rows, posts } = input;
  const now = input.now ?? Date.now();
  const limits = { ...OPPORTUNITY_DEFAULTS, ...input.limits };
  const maxResults = input.maxResults ?? 6;

  // Only mapped, published posts are eligible. A path with no post reference is
  // either another page of the site or a slug we do not own.
  const bySlug = new Map<string, AnalyticsPageRow>();
  for (const row of rows) {
    if (row.post) bySlug.set(row.post.slug, row);
  }

  const opportunities: Opportunity[] = [];
  const seen = new Set<string>();

  for (const post of posts) {
    if (!post.published) continue;
    if (seen.has(post.slug)) continue;

    const row = bySlug.get(post.slug);
    const ageDays = (now - Date.parse(post.date)) / 86_400_000;
    const oldEnough = Number.isFinite(ageDays) && ageDays >= limits.minimumAgeDays;
    const views = row?.pageviews ?? 0;
    const change = row?.change ?? null;
    const comparable =
      change !== null && views >= limits.minPageviews;

    let kind: OpportunityKind | null = null;
    let message = "";

    if (post.seo.noIndex && oldEnough) {
      kind = "noindex";
      message =
        "This post is marked no-index, so low search traffic is expected. It stays available to readers and in your site listings.";
    } else if (comparable && change !== null && change >= limits.minChangePercent) {
      kind = "rising";
      message = `Pageviews are up ${formatPercent(change)} versus the previous period (${views} in this period).`;
    } else if (comparable && change !== null && change <= -limits.minChangePercent) {
      kind = "declining";
      message = `Pageviews are down ${formatPercent(Math.abs(change))} versus the previous period (${views} in this period).`;
    } else if (oldEnough && views === 0) {
      kind = "unmeasured";
      message =
        "No visits recorded for this post yet. There is not enough analytics data to say anything about it.";
    } else {
      const months = monthsSince(post.updated || post.date, now);
      if (months !== null && months >= limits.staleMonths) {
        kind = "stale";
        message = `Last updated ${months} months ago. Worth checking the facts and links still hold.`;
      }
    }

    if (!kind) continue;
    seen.add(post.slug);
    opportunities.push({
      kind,
      slug: post.slug,
      title: post.title || post.slug,
      message,
      href: `/admin/analytics/posts/${encodeURIComponent(post.slug)}`,
    });
    if (opportunities.length >= maxResults) break;
  }

  return opportunities;
}

/**
 * The same rules, for a single post's drilldown page.
 *
 * Shared rather than re-implemented: a post that is called "rising" in the
 * table must not be called something else on its own page.
 */
export function buildOpportunitiesForPost(input: {
  post: PostMeta;
  performance: AnalyticsPagePerformance | null;
  now?: number;
  limits?: Partial<OpportunityLimits>;
}): Opportunity[] {
  const { post, performance } = input;

  // No report means no recommendation. "The provider could not be reached" and
  // "this post has no traffic" are different facts, and the second one is a
  // claim we have no data for when the fetch failed.
  if (!performance) return [];

  const rows: AnalyticsPageRow[] = [
    {
      path: performance.path,
      pageviews: performance.pageviews ?? 0,
      visitors: null,
      change: performance.change,
      kind: "post",
      post: {
        slug: post.slug,
        title: post.title,
        noIndex: post.seo.noIndex,
        updated: post.updated ?? null,
      },
    },
  ];

  return buildOpportunities({
    rows,
    posts: [post],
    ...(input.now !== undefined ? { now: input.now } : {}),
    ...(input.limits ? { limits: input.limits } : {}),
  });
}

/** `40%` / `-12.5%` → `"40%"` / `"12.5%"`, without a stray `.0`. */
function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}
