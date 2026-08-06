import { describe, expect, it } from "vitest";
import type { Post, PostMeta } from "./types";
import { isUnchangedPost } from "./validate";

const META: PostMeta = {
  title: "Hello",
  slug: "hello",
  date: "2026-01-15",
  excerpt: "An excerpt.",
  coverImage: "",
  tags: ["test"],
  published: true,
  focusKeyword: "hello",
  seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: false },
  faq: [],
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
