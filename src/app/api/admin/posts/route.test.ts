import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken } from "@/lib/auth/session";
import { postMetaSchema } from "@/lib/content/types";
import { POST as createPost } from "./route";
import { DELETE as deletePost, PATCH, PUT } from "./[slug]/route";
import { PUT as putSettings } from "../settings/route";

/**
 * The two runtime boundaries are mocked: next/headers (the cookie store that
 * getSession reads) and the content adapter (an in-memory fake). Everything
 * else — JWT signing/verification, zod validation, slug derivation, the
 * no-op-save and publish-stamping logic — runs for real.
 */
const h = vi.hoisted(() => {
  const posts = new Map<string, { content: string; frontmatter: Record<string, unknown> }>();
  const config: Record<string, unknown> = {};
  const adapter = {
    mode: "self-hosted" as const,
    listPosts: vi.fn(async () =>
      [...posts.entries()].map(([slug, p]) => ({
        slug,
        title: String(p.frontmatter.title ?? ""),
        date: String(p.frontmatter.date ?? ""),
        published: Boolean(p.frontmatter.published),
      }))
    ),
    getPost: vi.fn(async (slug: string) => {
      const p = posts.get(slug);
      return p ? { slug, content: p.content, meta: p.frontmatter } : null;
    }),
    savePost: vi.fn(
      async (slug: string, content: string, frontmatter: Record<string, unknown>) => {
        posts.set(slug, { content, frontmatter });
      }
    ),
    deletePost: vi.fn(async (slug: string) => {
      posts.delete(slug);
    }),
    getSiteConfig: vi.fn(async () => config),
    saveSiteConfig: vi.fn(async (c: Record<string, unknown>) => {
      for (const key of Object.keys(config)) delete config[key];
      Object.assign(config, c);
    }),
  };
  return { adapter, posts, token: "", cookieName: "ansora_session" };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === h.cookieName && h.token ? { name, value: h.token } : undefined,
  })),
}));

vi.mock("@/lib/content", () => ({
  getAdapter: vi.fn(() => h.adapter),
}));

// 48 chars — passes the >= 32 requirement.
const SECRET = "test-jwt-secret-0123456789abcdef0123456789abcdef";
const DATE = "2026-08-06T00:00:00.000Z";

beforeEach(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  h.posts.clear();
  h.token = "";
  for (const fn of [
    h.adapter.listPosts,
    h.adapter.getPost,
    h.adapter.savePost,
    h.adapter.deletePost,
    h.adapter.saveSiteConfig,
  ]) {
    fn.mockClear();
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function jsonRequest(path: string, method: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Mint a real, verifiable session token into the mocked cookie store. */
async function authed() {
  h.token = await createSessionToken();
}

/** Seed a post through the adapter with the same normalization the routes use. */
async function seed(
  slug: string,
  meta: Record<string, unknown>,
  content = "# Body"
) {
  await h.adapter.savePost(slug, content, postMetaSchema.parse(meta));
}

describe("POST /api/admin/posts", () => {
  it("returns 401 without a session", async () => {
    const res = await createPost(
      jsonRequest("/api/admin/posts", "POST", { meta: { title: "X" }, body: "" })
    );
    expect(res.status).toBe(401);
  });

  it("creates a draft and derives the slug from the title", async () => {
    await authed();
    const res = await createPost(
      jsonRequest("/api/admin/posts", "POST", {
        meta: { title: "Hello World" },
        body: "# Hello",
      })
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, slug: "hello-world" });
    expect(h.adapter.savePost).toHaveBeenCalledWith(
      "hello-world",
      "# Hello",
      expect.objectContaining({
        title: "Hello World",
        slug: "hello-world",
        published: false,
      })
    );
    expect(h.posts.get("hello-world")?.content).toBe("# Hello");
  });

  it("honors an explicit slug", async () => {
    await authed();
    const res = await createPost(
      jsonRequest("/api/admin/posts", "POST", {
        meta: { title: "Custom", slug: "my/custom-path" },
        body: "",
      })
    );
    // Explicit slugs are still slugified at the route level (no nested paths).
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, slug: "my-custom-path" });
  });

  it("rejects an invalid meta shape", async () => {
    await authed();
    const res = await createPost(
      jsonRequest("/api/admin/posts", "POST", { meta: { title: 123 }, body: "" })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: /Invalid post data/ });
  });

  it("requires title and excerpt when publishing", async () => {
    await authed();
    const res = await createPost(
      jsonRequest("/api/admin/posts", "POST", {
        meta: { title: "Hi", published: true },
        body: "x",
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: /An excerpt is required before publishing/,
    });
  });

  it("returns 500 when the adapter fails to save", async () => {
    await authed();
    h.adapter.savePost.mockRejectedValueOnce(new Error("disk full"));
    const res = await createPost(
      jsonRequest("/api/admin/posts", "POST", {
        meta: { title: "X" },
        body: "",
      })
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: /Could not save the post/,
    });
  });

  it("rejects a slug collision", async () => {
    await authed();
    await seed("taken", { title: "Taken", slug: "taken" });
    const res = await createPost(
      jsonRequest("/api/admin/posts", "POST", {
        meta: { title: "T", slug: "taken" },
        body: "x",
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: /already exists/ });
  });
});

describe("PUT /api/admin/posts/[slug]", () => {
  it("returns 401 without a session", async () => {
    const res = await PUT(
      jsonRequest("/api/admin/posts/x", "PUT", { meta: {}, body: "" }),
      { params: Promise.resolve({ slug: "x" }) }
    );
    expect(res.status).toBe(401);
  });

  it("updates a draft without stamping `updated`", async () => {
    await authed();
    await seed("hello-world", { title: "Hello World", slug: "hello-world", date: DATE });
    const res = await PUT(
      jsonRequest("/api/admin/posts/hello-world", "PUT", {
        meta: { title: "Hello World", slug: "hello-world", date: DATE, excerpt: "New excerpt" },
        body: "# Updated",
      }),
      { params: Promise.resolve({ slug: "hello-world" }) }
    );
    expect(res.status).toBe(200);
    const stored = h.posts.get("hello-world")!;
    expect(stored.content).toBe("# Updated");
    expect(stored.frontmatter.excerpt).toBe("New excerpt");
    expect(stored.frontmatter.updated).toBeUndefined();
  });

  it("skips the save entirely for an unchanged re-save", async () => {
    await authed();
    await seed("hello-world", { title: "Hello World", slug: "hello-world", date: DATE }, "# Hello");
    // Clear the seed's own savePost call so the assertion only sees the route.
    h.adapter.savePost.mockClear();
    const res = await PUT(
      jsonRequest("/api/admin/posts/hello-world", "PUT", {
        meta: { title: "Hello World", slug: "hello-world", date: DATE },
        body: "# Hello",
      }),
      { params: Promise.resolve({ slug: "hello-world" }) }
    );
    expect(res.status).toBe(200);
    expect(h.adapter.savePost).not.toHaveBeenCalled();
  });

  it("renames the post when the slug changes", async () => {
    await authed();
    await seed("old-slug", { title: "Old", slug: "old-slug", date: DATE });
    const res = await PUT(
      jsonRequest("/api/admin/posts/old-slug", "PUT", {
        meta: { title: "New", slug: "new-slug", date: DATE },
        body: "# Moved",
      }),
      { params: Promise.resolve({ slug: "old-slug" }) }
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ slug: "new-slug" });
    expect(h.adapter.savePost).toHaveBeenCalledWith(
      "new-slug",
      "# Moved",
      expect.anything()
    );
    expect(h.adapter.deletePost).toHaveBeenCalledWith("old-slug");
  });

  it("stamps `updated` when editing a published post", async () => {
    await authed();
    await seed("pub", {
      title: "Published",
      slug: "pub",
      excerpt: "Excerpt",
      published: true,
      date: DATE,
    });
    await PUT(
      jsonRequest("/api/admin/posts/pub", "PUT", {
        meta: { title: "Published", slug: "pub", excerpt: "Excerpt", published: true, date: DATE },
        body: "# Changed",
      }),
      { params: Promise.resolve({ slug: "pub" }) }
    );
    expect(h.posts.get("pub")?.frontmatter.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("PATCH /api/admin/posts/[slug]", () => {
  it("publishes a draft that has title and excerpt", async () => {
    await authed();
    await seed("draft", { title: "Draft", slug: "draft", excerpt: "An excerpt", date: DATE });
    const res = await PATCH(
      jsonRequest("/api/admin/posts/draft", "PATCH", { published: true }),
      { params: Promise.resolve({ slug: "draft" }) }
    );
    expect(res.status).toBe(200);
    expect(h.posts.get("draft")?.frontmatter.published).toBe(true);
  });

  it("refuses to publish a post missing title or excerpt", async () => {
    await authed();
    await seed("draft", { title: "Draft", slug: "draft" });
    const res = await PATCH(
      jsonRequest("/api/admin/posts/draft", "PATCH", { published: true }),
      { params: Promise.resolve({ slug: "draft" }) }
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: /Add a title and excerpt before publishing/,
    });
  });

  it("returns 404 for a missing post", async () => {
    await authed();
    const res = await PATCH(
      jsonRequest("/api/admin/posts/ghost", "PATCH", { published: true }),
      { params: Promise.resolve({ slug: "ghost" }) }
    );
    expect(res.status).toBe(404);
  });

  it("skips the save when toggling to the current value", async () => {
    await authed();
    await seed("pub", {
      title: "Pub",
      slug: "pub",
      excerpt: "E",
      published: true,
      date: DATE,
    });
    // Clear the seed's own savePost call so the assertion only sees the route.
    h.adapter.savePost.mockClear();
    const res = await PATCH(
      jsonRequest("/api/admin/posts/pub", "PATCH", { published: true }),
      { params: Promise.resolve({ slug: "pub" }) }
    );
    expect(res.status).toBe(200);
    expect(h.adapter.savePost).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/posts/[slug]", () => {
  it("returns 401 without a session", async () => {
    const res = await deletePost(
      jsonRequest("/api/admin/posts/x", "DELETE", {}),
      { params: Promise.resolve({ slug: "x" }) }
    );
    expect(res.status).toBe(401);
  });

  it("deletes a post", async () => {
    await authed();
    await seed("bye", { title: "Bye", slug: "bye" });
    const res = await deletePost(
      jsonRequest("/api/admin/posts/bye", "DELETE", {}),
      { params: Promise.resolve({ slug: "bye" }) }
    );
    expect(res.status).toBe(200);
    expect(h.adapter.deletePost).toHaveBeenCalledWith("bye");
    expect(h.posts.has("bye")).toBe(false);
  });
});

describe("PUT /api/admin/settings", () => {
  it("returns 401 without a session", async () => {
    const res = await putSettings(
      jsonRequest("/api/admin/settings", "PUT", { title: "X" })
    );
    expect(res.status).toBe(401);
  });

  it("saves a valid site config", async () => {
    await authed();
    const res = await putSettings(
      jsonRequest("/api/admin/settings", "PUT", {
        title: "My Blog",
        baseUrl: "https://example.com",
      })
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true });
    expect(h.adapter.saveSiteConfig).toHaveBeenCalledWith(
      expect.objectContaining({ title: "My Blog", baseUrl: "https://example.com" })
    );
  });

  it("rejects an invalid site config", async () => {
    await authed();
    const res = await putSettings(
      jsonRequest("/api/admin/settings", "PUT", { title: 123 })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: /Invalid settings/ });
  });
});
