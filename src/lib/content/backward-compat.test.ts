import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_CONFIG,
  normalizeFrontmatter,
  postMetaSchema,
  serializeFrontmatter,
  siteConfigSchema,
} from "./types";

/**
 * The backward-compatibility contract for the content model.
 *
 * Running deployments have years of markdown files written by the *old*
 * schema. Every field added for GEO work must therefore be optional, defaulted,
 * and omitted on serialization when empty — otherwise the first edit an author
 * makes would rewrite their entire content repo.
 */
describe("backward compatibility with pre-GEO frontmatter", () => {
  it("applies defaults to frontmatter written before the new fields existed", () => {
    // Exactly the shape of a file written by an older Ansora version.
    const legacy = {
      title: "Self Hosting on a VPS",
      slug: "self-hosting-on-a-vps",
      date: "2026-07-25T08:30:00.000Z",
      excerpt: "A walkthrough.",
      coverImage: "https://example.com/a.png",
      tags: ["self-hosting", "docker"],
      published: true,
      focusKeyword: "self host a blog",
      seo: {
        metaTitle: "Self Hosting on a VPS",
        metaDescription: "A walkthrough.",
        canonicalUrl: "",
        noIndex: false,
      },
      faq: [{ question: "Does it need a DB?", answer: "No." }],
    };

    const meta = normalizeFrontmatter(legacy);

    expect(meta.title).toBe("Self Hosting on a VPS");
    expect(meta.tags).toEqual(["self-hosting", "docker"]);
    expect(meta.faq).toHaveLength(1);
    // New fields are present but empty, never undefined.
    expect(meta.answer).toBe("");
    expect(meta.updatedReason).toBe("");
    expect(meta.coverImageAlt).toBe("");
    expect(meta.takeaways).toEqual([]);
    expect(meta.sources).toEqual([]);
  });

  it("serializes a legacy post back to the exact key set it was written with", () => {
    // This is the guarantee that matters: opening and saving an old post must
    // not add empty `answer:`, `sources:` etc. to the author's content repo.
    const legacy = {
      title: "Self Hosting on a VPS",
      slug: "self-hosting-on-a-vps",
      date: "2026-07-25T08:30:00.000Z",
      excerpt: "A walkthrough.",
      coverImage: "https://example.com/a.png",
      tags: ["self-hosting"],
      published: true,
    };

    const serialized = serializeFrontmatter(normalizeFrontmatter(legacy));

    expect(Object.keys(serialized).sort()).toEqual(
      [
        "coverImage",
        "date",
        "excerpt",
        "published",
        "slug",
        "tags",
        "title",
      ].sort()
    );
    expect(serialized).not.toHaveProperty("answer");
    expect(serialized).not.toHaveProperty("takeaways");
    expect(serialized).not.toHaveProperty("sources");
    expect(serialized).not.toHaveProperty("updatedReason");
    expect(serialized).not.toHaveProperty("coverImageAlt");
  });

  it("omits blank values inside new list fields rather than writing empty entries", () => {
    const meta = postMetaSchema.parse({
      title: "T",
      takeaways: ["", "  ", "Real takeaway"],
      sources: [
        { title: "", url: "" },
        { title: "Real source", url: "https://example.com" },
      ],
    });
    const serialized = serializeFrontmatter(meta);
    expect(serialized.takeaways).toEqual(["Real takeaway"]);
    expect(serialized.sources).toHaveLength(1);
  });
});

describe("site config backward compatibility", () => {
  it("defaults the new author fields for an existing site.config.json", () => {
    const legacy = {
      title: "My Blog",
      description: "Words.",
      baseUrl: "https://blog.example.com",
      author: "Sam",
      defaultOgImage: "",
      social: { twitter: "", github: "https://github.com/sam", linkedin: "" },
      theme: { preset: "warm", accent: "", radius: "soft", headingFont: "serif" },
    };
    const config = siteConfigSchema.parse(legacy);
    expect(config.author).toBe("Sam");
    expect(config.authorBio).toBe("");
    expect(config.authorRole).toBe("");
    // Existing keys survive untouched.
    expect(config.social.github).toBe("https://github.com/sam");
    expect(config.theme.preset).toBe("warm");
  });

  it("keeps the exported default config valid against the schema", () => {
    expect(() => siteConfigSchema.parse(DEFAULT_SITE_CONFIG)).not.toThrow();
  });
});
