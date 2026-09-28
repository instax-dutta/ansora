import { describe, expect, it } from "vitest";
import type { PostMeta } from "../content/types";
import { collectTags, indexableSorted, isIndexable } from "../seo/publish";

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

describe("isIndexable", () => {
  it("excludes drafts", () => {
    expect(isIndexable(post({ published: false }))).toBe(false);
  });

  it("excludes posts explicitly marked noIndex", () => {
    // This is the defect-01 regression: a noIndex post must never reach the
    // sitemap, RSS, the JSON feed or llms.txt.
    expect(
      isIndexable(
        post({ seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: true } })
      )
    ).toBe(false);
  });

  it("includes a normal published post", () => {
    expect(isIndexable(post())).toBe(true);
  });
});

describe("indexableSorted", () => {
  it("drops drafts and noIndex posts, newest first by updated then date", () => {
    const result = indexableSorted([
      post({ slug: "old", date: "2026-01-01" }),
      post({ slug: "draft", date: "2026-05-01", published: false }),
      post({
        slug: "hidden",
        date: "2026-04-01",
        seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: true },
      }),
      post({ slug: "new", date: "2026-03-01", updated: "2026-09-01" }),
    ]);
    expect(result.map((p) => p.slug)).toEqual(["new", "old"]);
  });
});

describe("collectTags", () => {
  it("dedupes, trims empties and sorts", () => {
    const tags = collectTags([
      post({ tags: ["b", "a", "a"] }),
      post({ tags: ["a", "  "] }),
    ]);
    expect(tags).toEqual(["a", "b"]);
  });
});
