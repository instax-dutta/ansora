import { describe, expect, it } from "vitest";
import { postNeighbours, relatedPosts } from "./related";
import type { PostMeta } from "./types";

function post(over: Partial<PostMeta> = {}): PostMeta {
  return {
    title: "T",
    slug: "t",
    date: "2026-01-01",
    updatedReason: "",
    excerpt: "",
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

describe("relatedPosts", () => {
  it("ranks by shared tags, then recency", () => {
    const all = [
      post({ slug: "current", tags: ["a", "b"] }),
      post({ slug: "one-tag", tags: ["a"], date: "2026-05-01" }),
      post({ slug: "two-tags", tags: ["a", "b"], date: "2026-02-01" }),
      post({ slug: "newer-one-tag", tags: ["a"], date: "2026-09-01" }),
      post({ slug: "unrelated", tags: ["z"], date: "2026-09-01" }),
    ];
    expect(relatedPosts(all, all[0]).map((p) => p.slug)).toEqual([
      "two-tags",
      "newer-one-tag",
      "one-tag",
    ]);
  });

  it("never returns the post itself, drafts, or noIndex posts", () => {
    const all = [
      post({ slug: "current", tags: ["a"] }),
      post({ slug: "draft", tags: ["a"], published: false }),
      post({
        slug: "hidden",
        tags: ["a"],
        seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: true },
      }),
    ];
    expect(relatedPosts(all, all[0])).toEqual([]);
  });

  it("excludes posts with no tag overlap", () => {
    const all = [post({ slug: "current", tags: ["a"] }), post({ slug: "other", tags: ["b"] })];
    expect(relatedPosts(all, all[0])).toEqual([]);
  });

  it("respects the limit", () => {
    const all = [
      post({ slug: "current", tags: ["a"] }),
      ...Array.from({ length: 6 }, (_, i) => post({ slug: `p${i}`, tags: ["a"] })),
    ];
    expect(relatedPosts(all, all[0], 2)).toHaveLength(2);
  });
});

describe("postNeighbours", () => {
  it("returns newer and older in publication order", () => {
    const all = [
      post({ slug: "newest", date: "2026-03-01" }),
      post({ slug: "middle", date: "2026-02-01" }),
      post({ slug: "oldest", date: "2026-01-01" }),
    ];
    const { newer, older } = postNeighbours(all, all[1]);
    expect(newer?.slug).toBe("newest");
    expect(older?.slug).toBe("oldest");
  });

  it("returns null at either end", () => {
    const all = [post({ slug: "a", date: "2026-02-01" }), post({ slug: "b", date: "2026-01-01" })];
    expect(postNeighbours(all, all[0]).newer).toBeNull();
    expect(postNeighbours(all, all[1]).older).toBeNull();
  });

  it("skips drafts and noIndex posts when walking the sequence", () => {
    const all = [
      post({ slug: "a", date: "2026-03-01" }),
      post({ slug: "draft", date: "2026-02-01", published: false }),
      post({ slug: "b", date: "2026-01-01" }),
    ];
    const { newer, older } = postNeighbours(all, all[2]);
    expect(newer?.slug).toBe("a");
    expect(older).toBeNull();
  });

  it("returns both null when the post is not in the list", () => {
    const all = [post({ slug: "a" })];
    const result = postNeighbours(all, post({ slug: "missing" }));
    expect(result).toEqual({ newer: null, older: null });
  });
});
