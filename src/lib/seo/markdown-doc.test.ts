import { describe, expect, it } from "vitest";
import type { PostMeta, SiteConfig } from "@/lib/content/types";
import {
  buildAboutMarkdown,
  buildPostMarkdown,
  buildTagMarkdown,
  buildTagsIndexMarkdown,
} from "./markdown-doc";

const CONFIG: SiteConfig = {
  title: "Quiet Notes",
  description: "Writing about the open web.",
  baseUrl: "https://notes.example.com",
  author: "Sam Rivera",
  authorBio: "Engineer. Writes about infrastructure.",
  authorRole: "Staff engineer",
  defaultOgImage: "",
  social: {
    twitter: "",
    github: "https://github.com/sam",
    linkedin: "",
  },
  theme: { preset: "warm", accent: "", radius: "soft", headingFont: "serif" },
};

function meta(over: Partial<PostMeta> = {}): PostMeta {
  return {
    title: "How self-hosting works",
    slug: "how-self-hosting-works",
    date: "2026-01-01",
    updatedReason: "",
    excerpt: "A plain explanation.",
    answer: "",
    takeaways: [],
    coverImage: "",
    coverImageAlt: "",
    tags: ["self-hosting"],
    published: true,
    focusKeyword: "",
    seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: false },
    faq: [],
    sources: [],
    ...over,
  };
}

describe("buildPostMarkdown", () => {
  it("emits YAML frontmatter, a Source line and the body", () => {
    const out = buildPostMarkdown(
      meta(),
      "## Section\n\nBody text here.",
      CONFIG
    );
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain('title: "How self-hosting works"');
    expect(out).toContain("url: \"https://notes.example.com/blog/how-self-hosting-works\"");
    expect(out).toContain("Source: https://notes.example.com/blog/how-self-hosting-works");
    expect(out).toContain("## Section");
  });

  it("prefers the direct answer over the raw body when one exists", () => {
    const out = buildPostMarkdown(
      meta({ answer: "Self-hosting means running the server yourself." }),
      "The full body the author actually wrote.",
      CONFIG
    );
    expect(out).toContain("Self-hosting means running the server yourself.");
    expect(out).not.toContain("The full body the author actually wrote.");
  });

  it("falls back to the body when there is no answer", () => {
    const out = buildPostMarkdown(meta(), "The full body.", CONFIG);
    expect(out).toContain("The full body.");
  });

  it("appends the FAQ and sources so an agent gets the whole post", () => {
    const out = buildPostMarkdown(
      meta({
        faq: [
          { question: "Does it need a database?", answer: "No." },
          { question: "dropped", answer: "" },
        ],
        sources: [
          { title: "A paper", url: "https://example.com/p", author: "Ida", year: "2026" },
          { title: "", url: "", author: "", year: "" },
        ],
      }),
      "Body.",
      CONFIG
    );
    expect(out).toContain("## Does it need a database?");
    expect(out).not.toContain("dropped");
    expect(out).toContain("## Sources");
    expect(out).toContain("A paper - https://example.com/p - Ida - 2026");
  });

  it("escapes quotes and backslashes so the frontmatter stays parseable", () => {
    const out = buildPostMarkdown(
      meta({ title: 'He said "hi" \\ bye' }),
      "Body.",
      CONFIG
    );
    const fm = out.slice(4, out.indexOf("\n---", 4));
    expect(fm).toContain('title: "He said \\"hi\\" \\\\ bye"');
  });

  it("escapes a CDATA-style terminator is not needed here, but braces survive", () => {
    // Markdown is emitted raw, so nothing here should be silently stripped.
    const out = buildPostMarkdown(meta(), "Use {braces} and [links](/x).", CONFIG);
    expect(out).toContain("{braces}");
    expect(out).toContain("[links](/x)");
  });
});

describe("buildTagMarkdown", () => {
  it("normalizes the canonical URL while keeping the display name", () => {
    const out = buildTagMarkdown("Search Engine", [meta()], CONFIG);
    expect(out).toContain('title: "Posts tagged \\"Search Engine\\""');
    expect(out).toContain("https://notes.example.com/tags/search-engine");
  });
});

describe("buildTagsIndexMarkdown", () => {
  it("lists tags with counts", () => {
    const out = buildTagsIndexMarkdown(
      [
        { tag: "self-hosting", count: 3 },
        { tag: "docker", count: 1 },
      ],
      CONFIG
    );
    expect(out).toContain("- self-hosting (3 posts)");
    expect(out).toContain("- docker (1 post)");
  });
});

describe("buildAboutMarkdown", () => {
  it("includes the bio, role and configured profiles", () => {
    const out = buildAboutMarkdown(CONFIG);
    expect(out).toContain("# Sam Rivera");
    expect(out).toContain("Engineer. Writes about infrastructure.");
    expect(out).toContain("## Elsewhere");
    expect(out).toContain("[GitHub](https://github.com/sam)");
  });
});
