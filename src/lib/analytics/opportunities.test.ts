import { describe, expect, it } from "vitest";
import { postMetaSchema, type PostMeta } from "@/lib/content/types";
import type { AnalyticsPageRow } from "./types";
import { buildOpportunities, buildOpportunitiesForPost } from "./opportunities";

/**
 * "What to do next" is the part of an analytics dashboard most likely to
 * become a lie. Every recommendation here must be reproducible from numbers
 * the page also shows, must be suppressed when the sample is too small, and
 * must never claim that low traffic means a bad post.
 */

const NOW = new Date("2026-10-26T00:00:00Z").getTime();

function post(overrides: Record<string, unknown>): PostMeta {
  return postMetaSchema.parse({
    title: "A post",
    slug: "a-post",
    date: "2026-01-01",
    published: true,
    ...overrides,
  });
}

function row(
  slug: string,
  pageviews: number,
  change: number | null = null
): AnalyticsPageRow {
  return {
    path: `/blog/${slug}`,
    pageviews,
    visitors: null,
    change,
    kind: "post",
    post: {
      slug,
      title: `Post ${slug}`,
      noIndex: false,
      updated: null,
    },
  };
}

describe("buildOpportunities", () => {
  it("flags a rising post only above the sample and change thresholds", () => {
    const posts = [
      post({ slug: "hot", title: "Hot", date: "2026-09-01" }),
      post({ slug: "tiny", title: "Tiny", date: "2026-09-01" }),
      post({ slug: "flat", title: "Flat", date: "2026-09-01" }),
    ];
    const opportunities = buildOpportunities({
      rows: [row("hot", 400, 40), row("tiny", 3, 400), row("flat", 400, 4)],
      posts,
      now: NOW,
    });

    const rising = opportunities.filter((o) => o.kind === "rising");
    expect(rising).toHaveLength(1);
    expect(rising[0].slug).toBe("hot");
    expect(rising[0].message).toContain("40%");
    expect(rising[0].href).toBe("/admin/analytics/posts/hot");
  });

  it("flags a meaningful decline, not a rounding wobble", () => {
    const posts = [post({ slug: "falling", date: "2026-09-01" })];
    const opportunities = buildOpportunities({
      rows: [row("falling", 120, -60)],
      posts,
      now: NOW,
    });
    expect(opportunities.map((o) => o.kind)).toEqual(["declining"]);
    expect(opportunities[0].message).toContain("60%");
  });

  it("distinguishes 'not enough data yet' from 'performing badly'", () => {
    const posts = [
      post({ slug: "new-post", title: "Brand new", date: "2026-10-24" }),
      post({ slug: "quiet", title: "Quiet", date: "2026-08-01" }),
    ];
    const opportunities = buildOpportunities({
      rows: [row("new-post", 0, null), row("quiet", 0, null)],
      posts,
      now: NOW,
    });

    const unmeasured = opportunities.filter((o) => o.kind === "unmeasured");
    expect(unmeasured.map((o) => o.slug)).toEqual(["quiet"]);
    expect(unmeasured[0].message).not.toMatch(/poorly|fail|bad/i);
  });

  it("does not call a no-indexed post a search failure", () => {
    const posts = [
      post({
        slug: "hidden",
        title: "Hidden",
        date: "2026-08-01",
        seo: { noIndex: true },
      }),
    ];
    const opportunities = buildOpportunities({
      rows: [row("hidden", 500, 90)],
      posts,
      now: NOW,
    });
    const noindex = opportunities.find((o) => o.kind === "noindex");
    expect(noindex?.message).toMatch(/no-index/i);
    expect(noindex?.message).not.toMatch(/fix (your )?seo/i);
  });

  it("suggests an update review for an old post", () => {
    const posts = [post({ slug: "old", title: "Old", date: "2025-01-01" })];
    const opportunities = buildOpportunities({
      rows: [row("old", 900, 5)],
      posts,
      now: NOW,
    });
    expect(opportunities.map((o) => o.kind)).toContain("stale");
  });

  it("ignores drafts, unmeasured paths and 'other' pages", () => {
    const opportunities = buildOpportunities({
      rows: [
        row("draft", 1000, 200),
        {
          path: "/somewhere",
          pageviews: 5000,
          visitors: null,
          change: 300,
          kind: "other",
          post: null,
        },
      ],
      posts: [post({ slug: "draft", title: "Draft", published: false })],
      now: NOW,
    });
    expect(opportunities).toEqual([]);
  });

  it("returns at most one recommendation per post and respects the cap", () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      post({ slug: `p${i}`, title: `P${i}`, date: "2025-01-01" })
    );
    const opportunities = buildOpportunities({
      rows: posts.map((p) => row(p.slug, 500, 80)),
      posts,
      now: NOW,
      maxResults: 4,
    });
    expect(opportunities).toHaveLength(4);
    const slugs = opportunities.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("accepts tighter thresholds from the caller", () => {
    const posts = [post({ slug: "small", date: "2026-09-01" })];
    const rows = [row("small", 20, 10)];
    expect(buildOpportunities({ rows, posts, now: NOW })).toEqual([]);
    expect(
      buildOpportunities({
        rows,
        posts,
        now: NOW,
        limits: { minPageviews: 10, minChangePercent: 5 },
      }).map((o) => o.kind)
    ).toEqual(["rising"]);
  });

  it("applies the same rules to a single post's drilldown", () => {
    const hot = post({ slug: "hot", title: "Hot", date: "2026-09-01" });
    expect(
      buildOpportunitiesForPost({
        post: hot,
        performance: {
          path: "/blog/hot",
          trend: [],
          fetchedAt: "2026-10-26T00:00:00.000Z",
          pageviews: 500,
          previousPageviews: 200,
          change: 150,
          visits: 300,
          sources: [],
          campaigns: [],
        },
        now: NOW,
      }).map((o) => o.kind)
    ).toEqual(["rising"]);
  });

  it("says nothing when the report itself failed to load", () => {
    const quiet = post({ slug: "quiet", title: "Quiet", date: "2026-08-01" });
    // "The provider could not be reached" is not evidence about this post, so
    // no recommendation is emitted rather than an unmeasured/declining claim.
    expect(buildOpportunitiesForPost({ post: quiet, performance: null, now: NOW })).toEqual([]);
  });

  it("is deterministic for the same inputs", () => {
    const posts = [
      post({ slug: "b", title: "B", date: "2026-09-01" }),
      post({ slug: "a", title: "A", date: "2026-09-01" }),
    ];
    const rows = [row("b", 300, 50), row("a", 300, 50)];
    const first = buildOpportunities({ rows, posts, now: NOW });
    const second = buildOpportunities({ rows, posts, now: NOW });
    expect(first).toEqual(second);
  });
});
