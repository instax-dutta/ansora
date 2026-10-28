import { describe, expect, it } from "vitest";
import { postMetaSchema, type PostMeta } from "@/lib/content/types";
import {
  classifyPath,
  mapPageRowsToPosts,
  normalisePath,
  withPageChange,
} from "./paths";

/**
 * Provider paths are not Ansora slugs. They arrive with trailing slashes,
 * percent-encoding, query strings and occasionally a full origin. Mapping them
 * to posts is a security boundary as much as a convenience: only a *published*
 * post may be named in the dashboard, and a draft slug must never be echoed
 * back as a link.
 */

const BASE = "https://blog.example.com";

function post(overrides: Record<string, unknown>): PostMeta {
  return postMetaSchema.parse({
    title: "A post",
    slug: "a-post",
    date: "2026-01-01",
    published: true,
    ...overrides,
  });
}

const POSTS: PostMeta[] = [
  post({ slug: "self-hosting", title: "Self hosting" }),
  post({ slug: "seo-basics", title: "SEO basics", seo: { noIndex: true } }),
  post({ slug: "draft-post", title: "Secret draft", published: false }),
];

describe("normalisePath", () => {
  it("strips the origin, query string and hash", () => {
    expect(normalisePath("https://blog.example.com/blog/self-hosting?utm=x#top")).toBe(
      "/blog/self-hosting"
    );
    expect(normalisePath("https://blog.example.com/blog/self-hosting?utm=x#top", BASE)).toBe(
      "/blog/self-hosting"
    );
  });

  it("collapses duplicate and trailing slashes", () => {
    expect(normalisePath("//blog//self-hosting//")).toBe("/blog/self-hosting");
    expect(normalisePath("/")).toBe("/");
    expect(normalisePath("")).toBe("/");
  });

  it("decodes percent-encoded segments", () => {
    expect(normalisePath("/blog/caf%C3%A9")).toBe("/blog/café");
    expect(normalisePath("/blog/%E0%A4%85")).toBe("/blog/अ");
  });

  it("keeps a malformed percent-encoding instead of throwing", () => {
    expect(normalisePath("/blog/100%")).toBe("/blog/100%");
  });

  it("rejects foreign hosts, whitespace and traversal", () => {
    expect(normalisePath("https://evil.example.com/blog/x", BASE)).toBeNull();
    expect(normalisePath("//evil.example.com/blog/x", BASE)).toBeNull();
    expect(normalisePath("/blog/../admin")).toBeNull();
    expect(normalisePath("/blog/x y")).toBeNull();
    expect(normalisePath("javascript:alert(1)")).toBeNull();
  });
});

describe("classifyPath", () => {
  it("recognises the public route shapes", () => {
    expect(classifyPath("/")).toEqual({ kind: "home", slug: null });
    expect(classifyPath("/blog")).toEqual({ kind: "blog", slug: null });
    expect(classifyPath("/blog/self-hosting")).toEqual({
      kind: "post",
      slug: "self-hosting",
    });
    expect(classifyPath("/tags/seo")).toEqual({ kind: "tag", slug: "seo" });
    expect(classifyPath("/about")).toEqual({ kind: "about", slug: null });
    expect(classifyPath("/admin")).toEqual({ kind: "other", slug: null });
    expect(classifyPath("/blog/a/b")).toEqual({ kind: "other", slug: null });
  });
});

describe("mapPageRowsToPosts", () => {
  it("maps a published post path to its metadata", () => {
    const rows = mapPageRowsToPosts(
      [{ path: "/blog/self-hosting/", pageviews: 120 }],
      POSTS,
      BASE
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe("/blog/self-hosting");
    expect(rows[0].pageviews).toBe(120);
    expect(rows[0].kind).toBe("post");
    expect(rows[0].post).toEqual({
      slug: "self-hosting",
      title: "Self hosting",
      noIndex: false,
      updated: null,
    });
  });

  it("never links a draft, even when the provider saw its URL", () => {
    const rows = mapPageRowsToPosts(
      [{ path: "/blog/draft-post", pageviews: 4 }],
      POSTS,
      BASE
    );
    expect(rows[0].post).toBeNull();
    expect(rows[0].kind).toBe("other");
    expect(JSON.stringify(rows)).not.toContain("Secret draft");
  });

  it("flags a no-indexed post rather than hiding it", () => {
    const rows = mapPageRowsToPosts(
      [{ path: "/blog/seo-basics", pageviews: 300 }],
      POSTS,
      BASE
    );
    expect(rows[0].post?.noIndex).toBe(true);
    expect(rows[0].post?.slug).toBe("seo-basics");
  });

  it("merges paths that only differ by trailing slash or encoding", () => {
    const rows = mapPageRowsToPosts(
      [
        { path: "/blog/self-hosting", pageviews: 10, visitors: 5 },
        { path: "/blog/self-hosting/", pageviews: 6, visitors: 3 },
        { path: "https://blog.example.com/blog/caf%C3%A9", pageviews: 1 },
      ],
      POSTS,
      BASE
    );
    const merged = rows.find((r) => r.path === "/blog/self-hosting");
    expect(merged?.pageviews).toBe(16);
    expect(merged?.visitors).toBe(8);
  });

  it("drops provider rows that are not site paths and sorts by views", () => {
    const rows = mapPageRowsToPosts(
      [
        { path: "/blog", pageviews: 10 },
        { path: "https://evil.example.com/x", pageviews: 999 },
        { path: "/blog/self-hosting", pageviews: 50 },
      ],
      POSTS,
      BASE
    );
    expect(rows.map((r) => r.pageviews)).toEqual([50, 10]);
  });
});

describe("withPageChange", () => {
  it("attaches a percentage change from the previous period", () => {
    const current = mapPageRowsToPosts(
      [{ path: "/blog/self-hosting", pageviews: 150 }],
      POSTS,
      BASE
    );
    const rows = withPageChange(current, [{ path: "/blog/self-hosting", pageviews: 100 }]);
    expect(rows[0].change).toBe(50);
  });

  it("leaves change unknown when the previous period had no data", () => {
    const current = mapPageRowsToPosts(
      [{ path: "/blog/self-hosting", pageviews: 150 }],
      POSTS,
      BASE
    );
    expect(withPageChange(current, [])[0].change).toBeNull();
  });

  it("matches the previous period through the same path normalisation", () => {
    const current = mapPageRowsToPosts(
      [{ path: "/blog/self-hosting", pageviews: 50 }],
      POSTS,
      BASE
    );
    const rows = withPageChange(current, [
      { path: "/blog/self-hosting/", pageviews: 200 },
    ]);
    expect(rows[0].change).toBe(-75);
  });
});
