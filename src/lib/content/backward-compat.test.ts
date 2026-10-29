import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_CONFIG,
  DEFAULT_THEME_CONFIG,
  normalizeFrontmatter,
  postMetaSchema,
  serializeFrontmatter,
  serializeSiteConfig,
  siteConfigReadSchema,
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
      theme: { preset: "inkline", accent: "", radius: "soft", headingFont: "serif" },
    };
    const config = siteConfigSchema.parse(legacy);
    expect(config.author).toBe("Sam");
    expect(config.authorBio).toBe("");
    expect(config.authorRole).toBe("");
    // Existing keys survive untouched.
    expect(config.social.github).toBe("https://github.com/sam");
    expect(config.theme.preset).toBe("inkline");
  });

  it("degrades a preset id this version no longer curates, without resetting the site", () => {
    // A repo written by an older Ansora carries a preset this build removed.
    // The tolerant read schema must fall back to the default *theme* while
    // every other setting (title, base URL, author) survives — the whole-config
    // fallback would otherwise hand the author an empty-looking site.
    const legacy = {
      title: "Still Here",
      description: "Words.",
      baseUrl: "https://blog.example.com",
      author: "Sam",
      theme: { preset: "raku", accent: "", radius: "soft", headingFont: "serif" },
    };
    const config = siteConfigReadSchema.parse(legacy);
    expect(config.title).toBe("Still Here");
    expect(config.author).toBe("Sam");
    expect(config.theme.preset).toBe(DEFAULT_THEME_CONFIG.preset);
  });

  it("keeps the exported default config valid against the schema", () => {
    expect(() => siteConfigSchema.parse(DEFAULT_SITE_CONFIG)).not.toThrow();
  });
});

/**
 * Analytics settings were added on top of a config file that is committed to
 * the author's git repo. The contract is the same one the frontmatter follows:
 * a deployment that never enables analytics must never see its config file
 * change because of the feature.
 */
describe("analytics settings are additive and ignored when unused", () => {
  const legacy = {
    title: "My Blog",
    description: "Words.",
    baseUrl: "https://blog.example.com",
    author: "Sam",
    defaultOgImage: "",
    social: { twitter: "", github: "", linkedin: "" },
    theme: { preset: "broadsheet", accent: "#336699", radius: "soft", headingFont: "serif" },
  };

  it("parses an old config with analytics disabled and the original theme intact", () => {
    const config = siteConfigSchema.parse(legacy);
    expect(config.analytics).toEqual({
      enabled: false,
      provider: "none",
      websiteId: "",
      baseUrl: "",
      reportBaseUrl: "",
    });
    expect(config.theme.preset).toBe("broadsheet");
    expect(config.title).toBe("My Blog");
  });

  it("serializes a legacy config without inventing an analytics block", () => {
    const parsed = siteConfigSchema.parse(legacy);
    const text = serializeSiteConfig(parsed);
    expect(JSON.parse(text)).not.toHaveProperty("analytics");

    // Byte-for-byte what the pre-analytics serializer wrote: JSON.stringify of
    // the parsed config, with the analytics block removed.
    const rest: Record<string, unknown> = { ...parsed };
    delete rest.analytics;
    expect(text).toBe(`${JSON.stringify(rest, null, 2)}\n`);
  });

  it("writes the analytics block once it is actually configured", () => {
    const config = siteConfigSchema.parse({
      ...legacy,
      analytics: {
        enabled: true,
        provider: "umami",
        websiteId: "8f2c",
        baseUrl: "https://analytics.example.com",
      },
    });
    const roundTripped = JSON.parse(serializeSiteConfig(config));
    expect(roundTripped.analytics).toMatchObject({
      enabled: true,
      provider: "umami",
      websiteId: "8f2c",
    });
    expect(roundTripped.theme.preset).toBe("broadsheet");
  });

  it("tolerates a malformed analytics URL instead of resetting the whole site config", () => {
    // A typo in an optional integration must degrade that panel, not wipe the
    // author's title, base URL and theme (which is what a throwing schema would
    // cause, since both adapters fall back to DEFAULT_SITE_CONFIG on error).
    const config = siteConfigSchema.parse({
      ...legacy,
      analytics: { enabled: true, provider: "umami", baseUrl: "not a url" },
    });
    expect(config.baseUrl).toBe("https://blog.example.com");
    expect(config.theme.preset).toBe("broadsheet");
    expect(config.analytics.baseUrl).toBe("not a url");
  });

  it("rejects an unknown provider rather than silently pretending it works", () => {
    const result = siteConfigSchema.safeParse({
      ...legacy,
      analytics: { enabled: true, provider: "matomo" },
    });
    expect(result.success).toBe(false);
  });
});
