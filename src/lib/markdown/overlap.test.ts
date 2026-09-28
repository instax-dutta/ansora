import { describe, expect, it } from "vitest";
import {
  findCannibalization,
  findOrphanWarning,
  monthsSince,
} from "./overlap";
import type { PostMeta } from "../content/types";

function post(over: Partial<PostMeta> = {}): PostMeta {
  return {
    title: "A post",
    slug: "a-post",
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

describe("findCannibalization", () => {
  it("flags a shared focus keyword as high severity", () => {
    const warnings = findCannibalization(
      post({ title: "Best local AI models", focusKeyword: "local ai models" }),
      [
        post({
          slug: "other",
          title: "Completely different topic",
          focusKeyword: "local ai models",
        }),
      ]
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("high");
  });

  it("ignores focus-keyword case and surrounding space", () => {
    const warnings = findCannibalization(
      post({ focusKeyword: "  Local AI  " }),
      [post({ slug: "b", focusKeyword: "local ai" })]
    );
    expect(warnings[0].severity).toBe("high");
  });

  it("flags heavily overlapping titles", () => {
    const warnings = findCannibalization(
      post({ title: "Spark X2.5 review: what a 4B coding agent can do" }),
      [post({ slug: "b", title: "Spark X2.5 review what a 4B coding agent can do" })]
    );
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("does not flag unrelated posts", () => {
    const warnings = findCannibalization(
      post({ title: "PorchLights network scam protection" }),
      [
        post({ slug: "b", title: "Best local AI models by VRAM tier" }),
        post({ slug: "c", title: "Context rot in long agent loops" }),
      ]
    );
    expect(warnings).toEqual([]);
  });

  it("never matches the post against itself", () => {
    const self = post({ title: "Identical title here", focusKeyword: "identical title" });
    expect(findCannibalization(self, [self])).toEqual([]);
  });

  it("ignores drafts as competitors", () => {
    const warnings = findCannibalization(
      post({ focusKeyword: "kw" }),
      [post({ slug: "b", focusKeyword: "kw", published: false })]
    );
    expect(warnings).toEqual([]);
  });
});

describe("findOrphanWarning", () => {
  it("warns when a published post has no tags", () => {
    const w = findOrphanWarning(post({ tags: [] }));
    expect(w?.kind).toBe("orphan");
  });

  it("stays quiet when the post has any tag", () => {
    expect(findOrphanWarning(post({ tags: ["x"] }))).toBeNull();
  });

  it("warns regardless of how well tagged the rest of the blog is", () => {
    // Related selection is tag-overlap based, so a tagless post can never be
    // pulled into a peer's related list even when every other post is tagged.
    const w = findOrphanWarning(post({ tags: [] }));
    expect(w?.kind).toBe("orphan");
  });

  it("stays quiet for a draft", () => {
    expect(findOrphanWarning(post({ tags: [], published: false }))).toBeNull();
  });
});

describe("monthsSince", () => {
  const now = new Date("2026-10-01T00:00:00Z").getTime();

  it("returns null inside the first month so the badge stays quiet", () => {
    expect(monthsSince("2026-09-25T00:00:00Z", now)).toBeNull();
    expect(monthsSince("2026-09-05T00:00:00Z", now)).toBeNull();
  });

  it("counts whole months once past 30 days", () => {
    expect(monthsSince("2026-08-31T00:00:00Z", now)).toBe(1);
    expect(monthsSince("2026-06-01T00:00:00Z", now)).toBe(4);
  });

  it("tolerates a bad date", () => {
    expect(monthsSince("not-a-date", now)).toBeNull();
  });
});
