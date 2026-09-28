import { describe, expect, it } from "vitest";
import type { Post, PostMeta } from "./types";
import { assertPublishable, isUnchangedPost, PayloadError } from "./validate";

const META: PostMeta = {
  title: "Hello",
  slug: "hello",
  date: "2026-01-15",
  updatedReason: "",
  excerpt: "An excerpt.",
  answer: "",
  takeaways: [],
  coverImage: "",
  coverImageAlt: "",
  tags: ["test"],
  published: true,
  focusKeyword: "hello",
  seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: false },
  faq: [],
  sources: [],
};

const POST: Post = {
  meta: { ...META, updated: "2026-02-01" },
  content: "Body text.",
  fileName: "hello.md",
};

describe("isUnchangedPost", () => {
  it("is true when nothing meaningful changed", () => {
    // Same body + same meta, even with a differing `updated` stamp.
    expect(isUnchangedPost(POST, { ...META, updated: "2026-02-01" }, "Body text.")).toBe(
      true
    );
    // No `updated` at all is also treated as unchanged (it's a derived field).
    expect(isUnchangedPost(POST, META, "Body text.")).toBe(true);
  });

  it("is false when the body changed", () => {
    expect(isUnchangedPost(POST, META, "Different body.")).toBe(false);
  });

  it("is false when a user-editable meta field changed", () => {
    expect(isUnchangedPost(POST, { ...META, title: "Other" }, "Body text.")).toBe(false);
    expect(isUnchangedPost(POST, { ...META, slug: "renamed" }, "Body text.")).toBe(false);
    expect(isUnchangedPost(POST, { ...META, published: false }, "Body text.")).toBe(false);
    expect(isUnchangedPost(POST, { ...META, tags: ["other"] }, "Body text.")).toBe(false);
  });
});

describe("assertPublishable", () => {
  const withSeo = (canonicalUrl: string, over: Partial<PostMeta> = {}): PostMeta => ({
    ...META,
    seo: { ...META.seo, canonicalUrl },
    ...over,
  });

  it("accepts an empty canonical, which means 'use the post URL'", () => {
    expect(() => assertPublishable(withSeo(""))).not.toThrow();
    expect(() => assertPublishable(withSeo("   "))).not.toThrow();
  });

  it("accepts absolute http(s) canonicals", () => {
    expect(() => assertPublishable(withSeo("https://a.dev/post"))).not.toThrow();
    expect(() => assertPublishable(withSeo("http://a.dev/post"))).not.toThrow();
  });

  it("rejects a canonical that is not a URL, even for a draft", () => {
    // Blocking on every save means a typo is caught when typed, not on the
    // first publish - a bad canonical can deindex a post outright.
    expect(() => assertPublishable(withSeo("not a url"))).toThrow(PayloadError);
    expect(() => assertPublishable(withSeo("/relative/path"))).toThrow(PayloadError);
    expect(() => assertPublishable(withSeo("javascript:alert(1)"))).toThrow(PayloadError);
    expect(() =>
      assertPublishable(withSeo("nope", { published: false }))
    ).toThrow(PayloadError);
  });

  it("still requires a title and excerpt to publish", () => {
    expect(() => assertPublishable({ ...META, title: "  " })).toThrow(PayloadError);
    expect(() => assertPublishable({ ...META, excerpt: "  " })).toThrow(PayloadError);
    // ...but a draft needs neither.
    expect(() =>
      assertPublishable({ ...META, title: "", excerpt: "", published: false })
    ).not.toThrow();
  });
});
