import { describe, expect, it } from "vitest";
import type { SiteConfig } from "@/lib/content/types";
import { resolveSerp, resolveSocial, truncate } from "./preview";

const CONFIG: SiteConfig = {
  title: "Quiet Notes",
  description: "Writing about the open web.",
  baseUrl: "https://notes.example.com",
  author: "Sam",
  authorBio: "",
  authorRole: "",
  defaultOgImage: "",
  social: { twitter: "", github: "", linkedin: "" },
  theme: { preset: "warm", accent: "", radius: "soft", headingFont: "serif" },
};

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("short", 60)).toBe("short");
  });

  it("cuts at a word boundary rather than mid-word", () => {
    const source = "self hosting a blog on a budget vps is not that hard";
    const out = truncate(source, 20);
    expect(out.endsWith("…")).toBe(true);
    // Everything before the ellipsis must be a whole-word prefix of the source.
    const kept = out.slice(0, -1);
    expect(source.startsWith(kept)).toBe(true);
    expect(source.charAt(kept.length)).toBe(" ");
  });

  it("collapses whitespace", () => {
    expect(truncate("a\n\n  b", 60)).toBe("a b");
  });

  it("does not clip an unspaced token to nothing", () => {
    const out = truncate("supercalifragilisticexpialidocious", 10);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("resolveSerp", () => {
  it("falls back to the title and excerpt", () => {
    const serp = resolveSerp(
      {
        title: "A post",
        slug: "a-post",
        excerpt: "An excerpt.",
        seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: false },
      },
      CONFIG
    );
    expect(serp.title).toBe("A post");
    expect(serp.description).toBe("An excerpt.");
    expect(serp.url).toBe("https://notes.example.com/blog/a-post");
  });

  it("prefers the explicit overrides", () => {
    const serp = resolveSerp(
      {
        title: "A post",
        slug: "a-post",
        excerpt: "An excerpt.",
        seo: {
          metaTitle: "Custom title",
          metaDescription: "Custom description.",
          canonicalUrl: "https://elsewhere.example.com/original",
          noIndex: false,
        },
      },
      CONFIG
    );
    expect(serp.title).toBe("Custom title");
    expect(serp.url).toBe("https://elsewhere.example.com/original");
  });

  it("flags a title that will be truncated in results", () => {
    const long = "a".repeat(80);
    expect(
      resolveSerp(
        {
          title: long,
          slug: "s",
          excerpt: "",
          seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: false },
        },
        CONFIG
      ).titleTruncated
    ).toBe(true);
  });
});

describe("resolveSocial", () => {
  it("prefers the post cover image and the large card", () => {
    const social = resolveSocial(
      {
        title: "T",
        excerpt: "E",
        coverImage: "https://cdn.example.com/a.png",
        seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: false },
      },
      CONFIG
    );
    expect(social.image).toBe("https://cdn.example.com/a.png");
    expect(social.card).toBe("summary_large_image");
    expect(social.missingImage).toBe(false);
  });

  it("falls back to the site default image", () => {
    const social = resolveSocial(
      {
        title: "T",
        excerpt: "E",
        coverImage: "",
        seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: false },
      },
      { ...CONFIG, defaultOgImage: "https://cdn.example.com/default.png" }
    );
    expect(social.image).toBe("https://cdn.example.com/default.png");
  });

  it("reports a missing image so the editor can warn about it", () => {
    const social = resolveSocial(
      {
        title: "T",
        excerpt: "E",
        coverImage: "",
        seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: false },
      },
      CONFIG
    );
    expect(social.missingImage).toBe(true);
    expect(social.card).toBe("summary");
  });
});
