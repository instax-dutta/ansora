import { describe, expect, it } from "vitest";
import type { PostMeta, SiteConfig } from "@/lib/content/types";
import {
  aboutUrl,
  authorId,
  blogId,
  buildAboutGraph,
  buildPostGraph,
  buildTagGraph,
  organizationId,
  postUrl,
  serializeJsonLd,
  siteId,
  tagUrl,
} from "./jsonld";

const CONFIG: SiteConfig = {
  title: "Quiet Notes",
  description: "Writing about the open web.",
  baseUrl: "https://notes.example.com/",
  author: "Sam Rivera",
  authorBio: "Engineer. Writes about infrastructure.",
  authorRole: "Staff engineer",
  defaultOgImage: "",
  social: {
    twitter: "https://twitter.com/sam",
    github: "https://github.com/sam",
    linkedin: "",
  },
  theme: {
    preset: "warm",
    accent: "",
    radius: "soft",
    headingFont: "serif",
  },
};

function meta(over: Partial<PostMeta> = {}): PostMeta {
  return {
    title: "How self-hosting works",
    slug: "how-self-hosting-works",
    date: "2026-01-01",
    updatedReason: "",
    excerpt: "A plain explanation of self-hosting a blog.",
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

/** Type-safe lookup across the emitted @graph. */
function node(graph: Record<string, unknown>, type: string) {
  const list = (graph["@graph"] ?? []) as Record<string, unknown>[];
  return list.find((n) => n["@type"] === type);
}

describe("entity ids and urls", () => {
  it("strips a trailing slash from baseUrl before building urls", () => {
    expect(postUrl(CONFIG, "x")).toBe("https://notes.example.com/blog/x");
    expect(tagUrl(CONFIG, "Search Engine")).toBe(
      "https://notes.example.com/tags/search-engine"
    );
    expect(aboutUrl(CONFIG)).toBe("https://notes.example.com/about");
  });

  it("exposes stable, distinct @ids per entity", () => {
    const ids = [siteId(CONFIG), organizationId(CONFIG), authorId(CONFIG), blogId(CONFIG)];
    expect(new Set(ids).size).toBe(4);
  });
});

describe("buildPostGraph", () => {
  it("emits the site entities plus the post, breadcrumb and no FAQ when empty", () => {
    const graph = buildPostGraph(meta(), CONFIG, { wordCount: 420 });
    const types = ((graph["@graph"] ?? []) as { "@type": string }[]).map(
      (n) => n["@type"]
    );
    expect(types).toContain("WebSite");
    expect(types).toContain("Organization");
    expect(types).toContain("Person");
    expect(types).toContain("BlogPosting");
    expect(types).toContain("BreadcrumbList");
    expect(types).not.toContain("FAQPage");
  });

  it("cross-references author and publisher by @id instead of a bare name", () => {
    const graph = buildPostGraph(meta(), CONFIG, { wordCount: 100 });
    const post = node(graph, "BlogPosting")!;
    // A dangling Person with only a name is an unresolvable entity; the whole
    // point of the graph is that these references resolve within the page.
    expect(post.author).toEqual({ "@id": authorId(CONFIG) });
    expect(post.publisher).toEqual({ "@id": organizationId(CONFIG) });
    expect(post.isPartOf).toEqual({ "@id": blogId(CONFIG) });
    expect(node(graph, "Person")!["@id"]).toBe(authorId(CONFIG));
  });

  it("carries wordCount, dates, keywords and about-entities for tags", () => {
    const graph = buildPostGraph(
      meta({ updated: "2026-06-01", tags: ["self-hosting", "Docker"] }),
      CONFIG,
      { wordCount: 1234 }
    );
    const post = node(graph, "BlogPosting")!;
    expect(post.wordCount).toBe(1234);
    expect(post.dateModified).toBe("2026-06-01");
    expect(post.keywords).toBe("self-hosting, Docker");
    expect((post.about as { name: string }[]).map((t) => t.name)).toEqual([
      "self-hosting",
      "Docker",
    ]);
  });

  it("adds speakable selectors only for the blocks that actually render", () => {
    const none = node(buildPostGraph(meta(), CONFIG, { wordCount: 10 }), "BlogPosting")!;
    expect(none.speakable).toBeUndefined();

    const answerOnly = node(
      buildPostGraph(meta({ answer: "Self-hosting means running it yourself." }), CONFIG, {
        wordCount: 10,
      }),
      "BlogPosting"
    )!;
    expect((answerOnly.speakable as { cssSelector: string[] }).cssSelector).toEqual([
      ".post-answer",
    ]);

    const both = node(
      buildPostGraph(
        meta({
          answer: "Direct answer.",
          faq: [{ question: "Q", answer: "A" }],
        }),
        CONFIG,
        { wordCount: 10 }
      ),
      "BlogPosting"
    )!;
    expect((both.speakable as { cssSelector: string[] }).cssSelector).toEqual([
      ".post-answer",
      ".post-faq",
    ]);
  });

  it("omits FAQPage when every question or answer is blank", () => {
    const graph = buildPostGraph(
      meta({ faq: [{ question: "", answer: "orphan answer" }] }),
      CONFIG,
      { wordCount: 10 }
    );
    expect(node(graph, "FAQPage")).toBeUndefined();
  });

  it("mirrors the visible breadcrumb as BreadcrumbList", () => {
    const graph = buildPostGraph(meta(), CONFIG, { wordCount: 10 });
    const crumbs = node(graph, "BreadcrumbList")!;
    const items = crumbs.itemListElement as { name: string; item: string }[];
    expect(items.map((i) => i.name)).toEqual([
      "Quiet Notes",
      "Blog",
      "How self-hosting works",
    ]);
    // The middle crumb must point at a route that exists (/blog).
    expect(items[1].item).toBe("https://notes.example.com/blog");
  });

  it("uses the cover image as an ImageObject with a caption", () => {
    const graph = buildPostGraph(
      meta({ coverImage: "https://cdn.example.com/a.png", coverImageAlt: "A server rack" }),
      CONFIG,
      { wordCount: 10 }
    );
    const post = node(graph, "BlogPosting")!;
    expect(post.image).toEqual({
      "@type": "ImageObject",
      url: "https://cdn.example.com/a.png",
      caption: "A server rack",
    });
  });
});

describe("sameAs handling", () => {
  it("only includes absolute http(s) profiles", () => {
    const org = node(
      buildPostGraph(meta(), CONFIG, { wordCount: 1 }),
      "Organization"
    )!;
    expect(org.sameAs).toEqual([
      "https://twitter.com/sam",
      "https://github.com/sam",
    ]);
  });

  it("omits sameAs entirely when no valid profile is configured", () => {
    const bare: SiteConfig = {
      ...CONFIG,
      social: { twitter: "", github: "not-a-url", linkedin: "" },
    };
    const org = node(buildPostGraph(meta(), bare, { wordCount: 1 }), "Organization")!;
    expect(org.sameAs).toBeUndefined();
  });
});

describe("buildAboutGraph", () => {
  it("gives the author entity a described, resolvable profile page", () => {
    const graph = buildAboutGraph(CONFIG);
    expect(node(graph, "ProfilePage")).toBeDefined();
    const person = node(graph, "Person")!;
    expect(person.url).toBe(aboutUrl(CONFIG));
    expect(person.jobTitle).toBe("Staff engineer");
    expect(person.description).toBe("Engineer. Writes about infrastructure.");
  });
});

describe("buildTagGraph", () => {
  it("describes the tag as an entity and lists the posts", () => {
    const graph = buildTagGraph(CONFIG, "Search Engine", [meta()]);
    const page = node(graph, "CollectionPage")!;
    const list = page.mainEntity as { numberOfItems: number };
    expect(list.numberOfItems).toBe(1);
    // The URL is normalized even though the display name is not.
    expect(page.url).toBe("https://notes.example.com/tags/search-engine");
    expect((node(graph, "Thing")! as { name: string }).name).toBe(
      "Search Engine"
    );
  });
});

describe("serializeJsonLd hardening still applies to graphs", () => {
  it("escapes a hostile headline inside a full page graph", () => {
    const graph = buildPostGraph(
      meta({ title: "evil</script><script>alert(1)</script>" }),
      CONFIG,
      { wordCount: 1 }
    );
    const out = serializeJsonLd(graph);
    expect(out).not.toContain("</script>");
    // Still valid JSON that round-trips.
    expect(JSON.parse(out)).toEqual(graph);
  });
});
