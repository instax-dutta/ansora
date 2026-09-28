import { describe, expect, it } from "vitest";
import type { PostMeta } from "../content/types";
import { buildIndexabilityReport } from "./indexability";
import {
  MIN_POSTS_FOR_TAG_INDEX,
  collectTags,
  indexableTags,
  isIndexable,
} from "./publish";

function post(over: Partial<PostMeta> = {}): PostMeta {
  return {
    title: "T",
    slug: "t",
    date: "2026-01-01",
    updatedReason: "",
    excerpt: "E",
    answer: "",
    takeaways: [],
    coverImage: "",
    coverImageAlt: "",
    tags: [],
    published: true,
    focusKeyword: "",
    seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: false },
    faq: [],
    sources: [],
    ...over,
  };
}

/**
 * The thresholds below were originally chosen while looking at one real blog
 * with 32 posts and 68 tags. These cases pin down that the policy is
 * defensible across the whole range of deployments the platform actually sees,
 * from a single untitled notebook to a large publication.
 */
describe("indexability policy across deployment sizes", () => {
  it("a brand-new site with one post still indexes the post itself", () => {
    const posts = [post({ slug: "first", tags: ["intro"] })];
    expect(isIndexable(posts[0])).toBe(true);
    // The only tag is thin, so no tag URL is advertised - but the post is.
    expect(indexableTags(posts)).toEqual([]);
    const report = buildIndexabilityReport(posts);
    expect(report.indexable).toBe(1);
    expect(report.coverage).toBe(100);
  });

  it("promotes a tag as soon as a second post joins it", () => {
    const posts = [
      post({ slug: "a", tags: ["deep"] }),
      post({ slug: "b", tags: ["deep"] }),
    ];
    expect(MIN_POSTS_FOR_TAG_INDEX).toBe(2);
    expect(indexableTags(posts)).toEqual(["deep"]);
  });

  it("never advertises a tag whose only posts are drafts", () => {
    const posts = [
      post({ slug: "a", tags: ["secret"] }),
      post({ slug: "b", tags: ["secret"], published: false }),
    ];
    expect(indexableTags(posts)).toEqual([]);
  });

  it("never advertises a tag whose only posts opted out of indexing", () => {
    const posts = [
      post({ slug: "a", tags: ["x"] }),
      post({
        slug: "b",
        tags: ["x"],
        seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: true },
      }),
    ];
    expect(indexableTags(posts)).toEqual([]);
  });

  it("scales to a large site without changing behaviour", () => {
    const posts = Array.from({ length: 500 }, (_, i) =>
      post({ slug: `p${i}`, tags: [`topic-${i % 25}`] })
    );
    const tags = indexableTags(posts);
    expect(tags).toHaveLength(25);
    // 500 posts across 25 evenly distributed topics = 20 each.
    const report = buildIndexabilityReport(posts);
    expect(report.indexedTags).toBe(25);
    expect(report.thinTags).toBe(0);
    expect(report.coverage).toBe(100);
  });

  it("separates a healthy vocabulary from a fragmented one", () => {
    // 20 posts, 20 tags: only the one repeated topic is worth indexing.
    const fragmented = Array.from({ length: 20 }, (_, i) =>
      post({ slug: `p${i}`, tags: [`solo-${i}`] })
    );
    expect(indexableTags(fragmented)).toEqual([]);

    const healthy = Array.from({ length: 20 }, (_, i) =>
      post({ slug: `p${i}`, tags: [`hub-${i % 2}`, `sub-${i}`] })
    );
    expect(indexableTags(healthy)).toEqual(["hub-0", "hub-1"]);
  });

  it("collectTags still sees every tag, including thin ones", () => {
    // The topics page needs the long tail; only the sitemap filters it.
    const posts = [post({ slug: "a", tags: ["only-one"] })];
    expect(collectTags(posts)).toEqual(["only-one"]);
  });
});

describe("buildIndexabilityReport", () => {
  it("reports null coverage for an empty site rather than a misleading 0%", () => {
    const report = buildIndexabilityReport([]);
    expect(report.coverage).toBeNull();
    expect(report.published).toBe(0);
  });

  it("accounts for drafts in neither the published nor opted-out count", () => {
    const report = buildIndexabilityReport([
      post({ slug: "a" }),
      post({ slug: "draft", published: false }),
    ]);
    expect(report.published).toBe(1);
    expect(report.indexable).toBe(1);
    expect(report.optedOut).toBe(0);
  });

  it("attributes coverage loss to the right cause", () => {
    const report = buildIndexabilityReport([
      post({ slug: "a", tags: ["x"] }),
      post({ slug: "b" }), // untagged
      post({
        slug: "c",
        seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: true },
      }),
    ]);
    expect(report.published).toBe(3);
    expect(report.indexable).toBe(2);
    expect(report.optedOut).toBe(1);
    expect(report.untagged).toBe(1);
    expect(report.coverage).toBe(67);
  });

  it("names the thin tags so the dashboard can explain itself", () => {
    const report = buildIndexabilityReport([
      post({ slug: "a", tags: ["deep"] }),
      post({ slug: "b", tags: ["deep"] }),
      post({ slug: "c", tags: ["lone"] }),
    ]);
    expect(report.thinTagNames).toEqual(["lone"]);
    expect(report.indexedTags).toBe(1);
    expect(report.tags).toBe(2);
  });
});
