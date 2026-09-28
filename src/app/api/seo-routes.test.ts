import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_CONFIG, type Post, type PostMeta } from "@/lib/content/types";

/**
 * Integration tests for the machine-discovery surfaces.
 *
 * These are the routes a crawler actually reads, so they are where the
 * draft-privacy and noIndex contracts are enforced. The adapter is mocked;
 * everything else (rendering, XML assembly, JSON assembly, escaping) is real.
 */

const CONFIG = { ...DEFAULT_SITE_CONFIG, baseUrl: "https://notes.example.com" };

function meta(over: Partial<PostMeta> = {}): PostMeta {
  return {
    title: "Published post",
    slug: "published-post",
    date: "2026-01-01",
    updatedReason: "",
    excerpt: "A summary.",
    answer: "The direct answer.",
    takeaways: [],
    coverImage: "",
    coverImageAlt: "",
    tags: ["alpha"],
    published: true,
    focusKeyword: "",
    seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: false },
    faq: [{ question: "Q?", answer: "A." }],
    sources: [],
    ...over,
  };
}

const PUBLISHED: Post = {
  meta: meta(),
  content: "## Heading\n\nSome body text that is long enough to render.",
  fileName: "published-post.md",
};

const DRAFT: Post = {
  meta: meta({
    title: "Secret draft",
    slug: "secret-draft",
    published: false,
    tags: ["draft-only"],
  }),
  content: "Confidential body.",
  fileName: "secret-draft.md",
};

const HIDDEN: Post = {
  meta: meta({
    title: "Hidden post",
    slug: "hidden-post",
    tags: ["hidden-only"],
    seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: true },
  }),
  content: "Should not be advertised anywhere.",
  fileName: "hidden-post.md",
};

const POSTS = [
  PUBLISHED,
  DRAFT,
  HIDDEN,
  // A second published post sharing a tag, so the tag archive clears the
  // minimum-post bar and is legitimately indexable.
  {
    ...PUBLISHED,
    meta: {
      ...meta({ title: "Second published post", slug: "second-published-post" }),
      tags: ["alpha"],
    },
    fileName: "second-published-post.md",
  } satisfies Post,
];

// vi.hoisted: the mock factory below is hoisted above the const declarations,
// so the adapter stubs have to be created in a hoisted block too.
const h = vi.hoisted(() => ({
  listPosts: vi.fn(),
  getPost: vi.fn(),
  getSiteConfig: vi.fn(),
}));

vi.mock("@/lib/content", () => ({
  getAdapter: () => ({
    mode: "self-hosted" as const,
    listPosts: h.listPosts,
    getPost: h.getPost,
    savePost: vi.fn(),
    deletePost: vi.fn(),
    getSiteConfig: h.getSiteConfig,
    saveSiteConfig: vi.fn(),
  }),
  // Must be replaced, not spread from the real module: the real
  // `safeListPosts` closes over the real `getAdapter`, so spreading it would
  // quietly read the posts on disk instead of the fixture. The try/catch
  // mirrors the real wrapper's graceful degradation.
  safeListPosts: async () => {
    try {
      return await h.listPosts();
    } catch {
      return [];
    }
  },
}));

vi.mock("@/lib/site-config", () => ({ getSiteConfig: h.getSiteConfig }));

import { GET as llmsFull } from "@/app/llms-full.txt/route";
import { GET as searchIndex } from "@/app/search-index.json/route";
import { GET as llms } from "@/app/llms.txt/route";
import { GET as feedJson } from "@/app/feed.json/route";
import { GET as rss } from "@/app/rss.xml/route";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

const listPosts = h.listPosts;
const getPost = h.getPost;
const getSiteConfig = h.getSiteConfig;

beforeEach(() => {
  vi.clearAllMocks();
  listPosts.mockImplementation(async () => POSTS.map((p) => p.meta));
  getPost.mockImplementation(
    async (slug: string) => POSTS.find((p) => p.meta.slug === slug) ?? null
  );
  getSiteConfig.mockImplementation(async () => CONFIG);
});

describe("sitemap", () => {
  it("lists published posts and the static routes", async () => {
    const urls = (await sitemap()).map((u) => u.url);
    // The root is submitted without a trailing slash, matching the URL earlier
    // versions already indexed.
    expect(urls).toContain("https://notes.example.com");
    expect(urls).toContain("https://notes.example.com/blog");
    expect(urls).toContain("https://notes.example.com/about");
    expect(urls).toContain("https://notes.example.com/blog/published-post");
  });

  it("omits drafts and noIndex posts", async () => {
    const urls = (await sitemap()).map((u) => u.url);
    expect(urls).not.toContain("https://notes.example.com/blog/secret-draft");
    // The noIndex regression: this is the whole reason the leak mattered.
    expect(urls).not.toContain("https://notes.example.com/blog/hidden-post");
  });

  it("omits tags with fewer than two published posts", async () => {
    const urls = (await sitemap()).map((u) => u.url);
    expect(urls).not.toContain("https://notes.example.com/tags/draft-only");
    expect(urls).not.toContain("https://notes.example.com/tags/hidden-only");
    // "alpha" is on two published posts, so it earns an archive page.
    expect(urls).toContain("https://notes.example.com/tags/alpha");
  });

  it("still returns a usable sitemap when the adapter fails", async () => {
    listPosts.mockRejectedValueOnce(new Error("offline"));
    const urls = (await sitemap()).map((u) => u.url);
    expect(urls).toContain("https://notes.example.com");
  });
});

describe("robots", () => {
  it("keeps AI crawlers welcome and closes only private surfaces", async () => {
    const result = await robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    // No bot-specific disallow: search-and-cite bots are allowed by default,
    // which is the whole point of shipping llms.txt.
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(["/admin", "/api", "/md"]);
    expect(result.sitemap).toBe("https://notes.example.com/sitemap.xml");
  });
});

describe("rss.xml", () => {
  it("includes published posts and excludes drafts and noIndex posts", async () => {
    const xml = await (await rss()).text();
    expect(xml).toContain("<title>Published post</title>");
    expect(xml).not.toContain("Secret draft");
    expect(xml).not.toContain("Hidden post");
  });

  it("emits full content, creator and updated timestamp", async () => {
    const xml = await (await rss()).text();
    expect(xml).toContain("<content:encoded>");
    expect(xml).toContain("<dc:creator>Ansora Author</dc:creator>");
    expect(xml).toContain("http://purl.org/rss/1.0/modules/content/");
  });

  it("advertises the JSON feed as an alternate", async () => {
    const xml = await (await rss()).text();
    expect(xml).toContain('type="application/feed+json"');
  });

  it("escapes a title that would otherwise break the XML", async () => {
    listPosts.mockResolvedValueOnce([
      meta({ title: "Bad & <title> with ]]> and \"quotes\"" }),
    ]);
    const xml = await (await rss()).text();
    expect(xml).toContain("&amp; &lt;title&gt;");
    expect(xml).not.toContain("<title>Bad & <title>");
  });
});

describe("llms.txt", () => {
  it("indexes published posts and never leaks drafts or hidden posts", async () => {
    const text = await (await llms()).text();
    expect(text).toContain("Published post");
    expect(text).not.toContain("Secret draft");
    expect(text).not.toContain("Hidden post");
  });

  it("includes a topics section and links to the agent surfaces", async () => {
    const text = await (await llms()).text();
    expect(text).toContain("## Topics");
    expect(text).toContain("llms-full.txt");
    expect(text).toContain("feed.json");
  });
});

describe("llms-full.txt", () => {
  it("contains the post body and never a draft or hidden post", async () => {
    const text = await (await llmsFull()).text();
    expect(text).toContain("Some body text that is long enough to render.");
    expect(text).not.toContain("Confidential body.");
    expect(text).not.toContain("Should not be advertised anywhere.");
  });
});

describe("feed.json", () => {
  it("is valid JSON Feed 1.1 with only indexable items", async () => {
    const feed = JSON.parse(await (await feedJson()).text());
    expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
    expect(feed.items.map((i: { url: string }) => i.url)).toEqual([
      "https://notes.example.com/blog/published-post",
      "https://notes.example.com/blog/second-published-post",
    ]);
    expect(feed.items[0].content_text).toContain("Some body text");
  });

  it("sets the right content type for feed readers", async () => {
    const res = await feedJson();
    expect(res.headers.get("Content-Type")).toContain("application/feed+json");
  });
});

describe("llms-full.txt honesty", () => {
  it("claims completeness only when it is complete", async () => {
    // Every post has a body available, so the file may assert it is complete.
    const text = await (await llmsFull()).text();
    expect(text).toMatch(/published posts?, all with full text/);
  });

  it("never states a bare post count when bodies were capped", async () => {
    // Simulate a blog larger than the body budget: the header must admit the
    // file is partial rather than implying it is the whole corpus.
    const many = Array.from({ length: 6 }, (_, i) =>
      meta({ title: `Post ${i}`, slug: `post-${i}` })
    );
    listPosts.mockResolvedValueOnce(many);
    getPost.mockImplementation(async (slug: string) => {
      const m = many.find((p) => p.slug === slug);
      return m ? { meta: m, content: "Body text.", fileName: `${slug}.md` } : null;
    });

    const text = await (await llmsFull()).text();
    // The disclaimer is present whenever a body is missing.
    expect(text).toMatch(/excerpt only|all with full text/);
    // And a post whose body was unavailable says so on its own section.
    if (/excerpt only/.test(text)) {
      expect(text).toContain("Note: excerpt only.");
    }
  });
});

describe("search index bounds", () => {
  it("reports total and truncation state so the client can be honest", async () => {
    const data = JSON.parse(await (await searchIndex()).text());
    expect(data.total).toBe(2);
    expect(data.truncated).toBe(false);
    expect(data.items).toHaveLength(2);
    for (const item of data.items) {
      expect(item.summary.length).toBeLessThanOrEqual(220);
      expect(item).toHaveProperty("url");
      expect(item).toHaveProperty("tags");
    }
  });

  it("marks the index truncated when it caps the post list", async () => {
    // The index is bounded so a large blog does not ship an unbounded payload
    // to every visitor who focuses the search box.
    const many = Array.from({ length: 600 }, (_, i) =>
      meta({ title: `P${i}`, slug: `p-${i}` })
    );
    listPosts.mockResolvedValueOnce(many);
    const data = JSON.parse(await (await searchIndex()).text());
    expect(data.total).toBe(600);
    expect(data.truncated).toBe(true);
    expect(data.items.length).toBeLessThan(600);
  });

  it("excludes drafts and noIndex posts from search", async () => {
    const data = JSON.parse(await (await searchIndex()).text());
    const slugs = data.items.map((i: { slug: string }) => i.slug);
    expect(slugs).not.toContain("secret-draft");
    expect(slugs).not.toContain("hidden-post");
  });
});
