import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken } from "@/lib/auth/session";
import { postMetaSchema, siteConfigSchema } from "@/lib/content/types";
import type { SiteConfig } from "@/lib/content/types";
import { clearAnalyticsCache } from "@/lib/analytics/cache";
import { GET as getOverview } from "./overview/route";
import { GET as getPages } from "./pages/route";
import { GET as getPostPerformance } from "./posts/[slug]/route";
import { GET as getHealth } from "./health/route";
import { POST as postVerify } from "./verify/route";
import { PUT as putConfig } from "./config/route";

/**
 * Route-level integration tests.
 *
 * The runtime boundaries are mocked (cookie store, content adapter, site
 * config) and the provider is reached through a stubbed `fetch`, so the real
 * resolution, validation, caching and Umami adapter code all run.
 *
 * The security assertions matter as much as the data ones: an unauthenticated
 * caller gets nothing, a cross-origin writer is rejected, a draft can never be
 * named, and no response body ever contains the API key.
 */
const h = vi.hoisted(() => {
  const posts = new Map<string, Record<string, unknown>>();
  const adapter = {
    mode: "self-hosted" as const,
    listPosts: vi.fn(async () => [...posts.values()]),
    getPost: vi.fn(async (slug: string) => {
      const meta = posts.get(slug);
      return meta ? { meta, content: "# Body", fileName: `${slug}.md` } : null;
    }),
    savePost: vi.fn(async () => {}),
    deletePost: vi.fn(async () => {}),
    getSiteConfig: vi.fn(async () => h.config),
    saveSiteConfig: vi.fn(async (next: unknown) => {
      h.config = siteConfigSchema.parse(next);
    }),
  };
  return {
    adapter,
    posts,
    // Parsed in beforeEach — `vi.hoisted` runs before module imports exist.
    config: null as unknown as SiteConfig,
    token: "",
    cookieName: "ansora_session",
  };
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

vi.mock("@/lib/site-config", () => ({
  getSiteConfig: vi.fn(async () => h.config),
  invalidateSiteConfig: vi.fn(),
}));

const SECRET = "test-jwt-secret-0123456789abcdef0123456789abcdef";
const API_KEY = "umami_test_secret_key_123";

function seedPost(overrides: Record<string, unknown>) {
  // Parsed like a real read, so `seo`, `tags` and the rest are always present.
  const meta = postMetaSchema.parse({
    title: "A post",
    slug: "a-post",
    date: "2026-09-01",
    excerpt: "Excerpt",
    published: true,
    ...overrides,
  }) as unknown as Record<string, unknown>;
  h.posts.set(String(meta.slug), meta);
  return meta;
}

function configureAnalytics(overrides: Record<string, unknown> = {}) {
  h.config = siteConfigSchema.parse({
    baseUrl: "https://blog.example.com",
    analytics: {
      enabled: true,
      provider: "umami",
      websiteId: "site-1",
      baseUrl: "https://analytics.example.com",
      ...overrides,
    },
  });
}

async function authed() {
  h.token = await createSessionToken();
}

function request(path: string, init: { method?: string; body?: unknown; origin?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.origin) headers.origin = init.origin;
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const STATS = {
  pageviews: 1200,
  visitors: 400,
  visits: 500,
  bounces: 200,
  totaltime: 50_000,
  comparison: { pageviews: 800, visitors: 300, visits: 350 },
};

const SERIES = {
  pageviews: [
    { x: "2026-09-01", y: 600 },
    { x: "2026-09-02", y: 600 },
  ],
  compare: { pageviews: [{ x: "2026-08-01", y: 800 }] },
};

/** Stub the provider surface by path, so every request is explicit. */
function stubProvider(
  handler: (url: URL) => Response | Promise<Response> = defaultHandler
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    return handler(new URL(String(input)));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function defaultHandler(url: URL): Response {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  if (url.pathname.endsWith("/stats")) return json(STATS);
  if (url.pathname.endsWith("/pageviews")) return json(SERIES);
  if (url.pathname.endsWith("/metrics")) {
    if (url.searchParams.get("type") === "path") {
      return json([
        { x: "/blog/published-post", y: 900 },
        { x: "/blog/published-post/", y: 100 },
        { x: "/blog/secret-draft", y: 5 },
        { x: "/blog", y: 50 },
      ]);
    }
    if (url.searchParams.get("type") === "referrer") {
      return json([
        { x: null, y: 300 },
        { x: "news.ycombinator.com", y: 120 },
      ]);
    }
    return json([{ x: "launch-week", y: 90 }]);
  }
  return json({ id: "site-1" });
}

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", SECRET);
  vi.stubEnv("ANALYTICS_API_KEY", API_KEY);
  vi.stubEnv("ANALYTICS_BASE_URL", "");
  vi.stubEnv("ANALYTICS_SCRIPT_ORIGIN", "");
  vi.stubEnv("ANALYTICS_PROVIDER", "");
  vi.stubEnv("ANALYTICS_WEBSITE_ID", "");
  h.posts.clear();
  h.token = "";
  h.config = siteConfigSchema.parse({});
  clearAnalyticsCache();
  h.adapter.saveSiteConfig.mockClear();
  seedPost({ slug: "published-post", title: "Published post" });
  seedPost({ slug: "secret-draft", title: "Secret draft", published: false });
  seedPost({
    slug: "hidden-post",
    title: "Hidden post",
    seo: { noIndex: true },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("authentication and origin checks", () => {
  it("rejects every analytics route without a session", async () => {
    stubProvider();
    const responses = await Promise.all([
      getOverview(request("/api/admin/analytics/overview")),
      getPages(request("/api/admin/analytics/pages")),
      getPostPerformance(request("/api/admin/analytics/posts/published-post"), {
        params: Promise.resolve({ slug: "published-post" }),
      }),
      getHealth(request("/api/admin/analytics/health")),
      postVerify(request("/api/admin/analytics/verify", { method: "POST" })),
      putConfig(
        request("/api/admin/analytics/config", {
          method: "PUT",
          body: { analytics: { enabled: true } },
        })
      ),
    ]);
    expect(responses.map((res) => res.status)).toEqual([401, 401, 401, 401, 401, 401]);
  });

  it("rejects cross-origin writes with 403", async () => {
    await authed();
    const verify = await postVerify(
      request("/api/admin/analytics/verify", {
        method: "POST",
        origin: "https://evil.example.com",
      })
    );
    const config = await putConfig(
      request("/api/admin/analytics/config", {
        method: "PUT",
        origin: "https://evil.example.com",
        body: { analytics: { enabled: true } },
      })
    );
    expect(verify.status).toBe(403);
    expect(config.status).toBe(403);
    expect(h.adapter.saveSiteConfig).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/analytics/overview", () => {
  it("reports the setup state instead of querying a disabled integration", async () => {
    await authed();
    const fetchMock = stubProvider();
    const res = await getOverview(request("/api/admin/analytics/overview"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(false);
    expect(body.overview).toBeNull();
    // No provider, no site, no tracker URL. The API key happens to be present
    // in this deployment, and must not be reported as the only blocker.
    expect(body.missing).toEqual(["a provider", "a website ID", "a tracker URL"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns totals, trend and the comparison window", async () => {
    await authed();
    configureAnalytics();
    stubProvider();
    const res = await getOverview(request("/api/admin/analytics/overview?days=7&timezone=Asia/Kolkata"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.overview.pageviews).toBe(1200);
    expect(body.overview.trend).toHaveLength(2);
    expect(body.overview.previousPeriod.pageviews).toBe(800);
    expect(body.query.timezone).toBe("Asia/Kolkata");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects an invalid range with 400 and a safe message", async () => {
    await authed();
    configureAnalytics();
    const fetchMock = stubProvider();
    const res = await getOverview(
      request("/api/admin/analytics/overview?from=2026-10-10&to=2026-10-01")
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "The start date must be on or before the end date.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("degrades instead of throwing when the provider rejects the key", async () => {
    await authed();
    configureAnalytics();
    stubProvider(() => new Response("{}", { status: 401 }));
    const res = await getOverview(request("/api/admin/analytics/overview"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.degraded.code).toBe("unauthorized");
    expect(body.overview).toBeNull();
    expect(JSON.stringify(body)).not.toContain(API_KEY);
  });

  it("degrades on sustained rate limiting without retrying forever", async () => {
    await authed();
    configureAnalytics();
    const fetchMock = stubProvider(() => new Response("{}", { status: 429 }));
    const res = await getOverview(request("/api/admin/analytics/overview"));
    const body = await res.json();
    expect(body.degraded.code).toBe("rate_limited");
    // Two endpoints, at most one retry each: bounded, not a loop. (The route
    // returns as soon as the first endpoint gives up, so the sibling request
    // may still be finishing its single retry.)
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("serves a repeated request from the cache", async () => {
    await authed();
    configureAnalytics();
    const fetchMock = stubProvider();
    await getOverview(request("/api/admin/analytics/overview?days=7"));
    const calls = fetchMock.mock.calls.length;
    await getOverview(request("/api/admin/analytics/overview?days=7"));
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});

describe("GET /api/admin/analytics/pages", () => {
  it("maps paths to published posts and merges trailing-slash duplicates", async () => {
    await authed();
    configureAnalytics();
    stubProvider();
    const res = await getPages(request("/api/admin/analytics/pages?days=7"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const post = body.rows.find((row: { path: string }) => row.path === "/blog/published-post");
    expect(post.pageviews).toBe(1000);
    expect(post.post).toEqual({
      slug: "published-post",
      title: "Published post",
      noIndex: false,
      updated: null,
    });
    // The draft path is a real request but must never resolve to a post.
    const draft = body.rows.find((row: { path: string }) => row.path === "/blog/secret-draft");
    expect(draft.post).toBeNull();
    expect(JSON.stringify(body)).not.toContain("Secret draft");
  });

  it("attaches a previous-period change", async () => {
    await authed();
    configureAnalytics();
    stubProvider((url) => {
      if (url.pathname.endsWith("/metrics") && url.searchParams.get("type") === "path") {
        // The current and previous windows are distinguished by startDate.
        const isPrevious = url.searchParams.get("startDate") === "2026-08-25";
        return new Response(
          JSON.stringify(isPrevious ? [{ x: "/blog/published-post", y: 500 }] : [{ x: "/blog/published-post", y: 1000 }]),
          { status: 200 }
        );
      }
      return defaultHandler(url);
    });
    const res = await getPages(
      request("/api/admin/analytics/pages?from=2026-09-01&to=2026-09-07")
    );
    const body = await res.json();
    expect(body.rows[0].change).toBe(100);
  });

  it("exports CSV with sanitised cells and a safe filename", async () => {
    await authed();
    seedPost({
      slug: "evil",
      title: '=HYPERLINK("http://evil.example","click")\nsecond row',
    });
    configureAnalytics();
    stubProvider((url) => {
      if (url.pathname.endsWith("/metrics") && url.searchParams.get("type") === "path") {
        return new Response(JSON.stringify([{ x: "/blog/evil", y: 10 }]), { status: 200 });
      }
      return defaultHandler(url);
    });

    const res = await getPages(request("/api/admin/analytics/pages?days=7&format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain("ansora-analytics-pages");
    const csv = await res.text();
    expect(csv).toContain("'=HYPERLINK");
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(2);
  });
});

describe("GET /api/admin/analytics/posts/[slug]", () => {
  it("returns 404 for a draft so analytics cannot confirm it exists", async () => {
    await authed();
    configureAnalytics();
    const fetchMock = stubProvider();
    const res = await getPostPerformance(
      request("/api/admin/analytics/posts/secret-draft"),
      { params: Promise.resolve({ slug: "secret-draft" }) }
    );
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown or hostile slug", async () => {
    await authed();
    configureAnalytics();
    stubProvider();
    for (const slug of ["nope", "../../etc/passwd"]) {
      const res = await getPostPerformance(
        request(`/api/admin/analytics/posts/${encodeURIComponent(slug)}`),
        { params: Promise.resolve({ slug }) }
      );
      expect(res.status, slug).toBe(404);
    }
  });

  it("returns the post's performance plus content context", async () => {
    await authed();
    configureAnalytics();
    stubProvider();
    const res = await getPostPerformance(
      request("/api/admin/analytics/posts/published-post"),
      { params: Promise.resolve({ slug: "published-post" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.post.slug).toBe("published-post");
    expect(body.post.url).toBe("https://blog.example.com/blog/published-post");
    expect(body.post.indexable).toBe(true);
    expect(body.path).toBe("/blog/published-post");
    expect(body.performance.pageviews).toBe(1200);
    expect(body.performance.sources[0]).toEqual({
      key: "Direct / unknown",
      pageviews: 300,
    });
  });

  it("reports a no-indexed post without implying it is broken", async () => {
    await authed();
    configureAnalytics();
    stubProvider();
    const res = await getPostPerformance(
      request("/api/admin/analytics/posts/hidden-post"),
      { params: Promise.resolve({ slug: "hidden-post" }) }
    );
    const body = await res.json();
    expect(body.post.indexable).toBe(false);
    expect(body.post.noIndex).toBe(true);
  });
});

describe("GET /api/admin/analytics/health", () => {
  it("reports configuration state, provider health and CSP status", async () => {
    await authed();
    configureAnalytics();
    stubProvider();
    const res = await getHealth(request("/api/admin/analytics/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      configured: true,
      tracking: true,
      reporting: true,
      provider: "umami",
      apiBase: "https://analytics.example.com/api",
    });
    expect(body.health.ok).toBe(true);
    // The tracker lives on another origin that the CSP does not allow yet.
    expect(body.cspAllowsTracker).toBe(false);
    expect(JSON.stringify(body)).not.toContain(API_KEY);
  });

  it("distinguishes 'collecting but cannot report' from 'not configured'", async () => {
    await authed();
    configureAnalytics();
    vi.stubEnv("ANALYTICS_API_KEY", "");
    const fetchMock = stubProvider();
    const res = await getHealth(request("/api/admin/analytics/health"));
    const body = await res.json();
    expect(body).toMatchObject({
      configured: false,
      tracking: true,
      reporting: false,
      health: null,
    });
    expect(body.missing).toEqual(["ANALYTICS_API_KEY"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/analytics/verify", () => {
  it("checks the provider connection without echoing credentials", async () => {
    await authed();
    configureAnalytics();
    stubProvider();
    const res = await postVerify(request("/api/admin/analytics/verify", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.health.provider).toBe("umami");
    expect(JSON.stringify(body)).not.toContain(API_KEY);
  });

  it("explains an unconfigured integration instead of calling the provider", async () => {
    await authed();
    const fetchMock = stubProvider();
    const res = await postVerify(request("/api/admin/analytics/verify", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("unconfigured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("PUT /api/admin/analytics/config", () => {
  it("saves the analytics block while keeping the rest of the config", async () => {
    await authed();
    h.config = siteConfigSchema.parse({ title: "Keep me", baseUrl: "https://blog.example.com" });
    const res = await putConfig(
      request("/api/admin/analytics/config", {
        method: "PUT",
        body: {
          analytics: {
            enabled: true,
            provider: "umami",
            websiteId: "site-1",
            baseUrl: "https://analytics.example.com",
          },
        },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analytics).toMatchObject({ enabled: true, provider: "umami", tracking: true });
    expect(h.adapter.saveSiteConfig).toHaveBeenCalledTimes(1);
    const saved = h.adapter.saveSiteConfig.mock.calls[0][0] as Record<string, unknown>;
    expect(saved.title).toBe("Keep me");
    expect(saved.analytics).toMatchObject({ enabled: true, websiteId: "site-1" });
  });

  it("rejects an unknown provider", async () => {
    await authed();
    const res = await putConfig(
      request("/api/admin/analytics/config", {
        method: "PUT",
        body: { analytics: { provider: "matomo" } },
      })
    );
    expect(res.status).toBe(400);
    expect(h.adapter.saveSiteConfig).not.toHaveBeenCalled();
  });

  it("invalidates cached reports so the next load reflects the new settings", async () => {
    await authed();
    configureAnalytics();
    const fetchMock = stubProvider();
    await getOverview(request("/api/admin/analytics/overview"));
    const before = fetchMock.mock.calls.length;

    await putConfig(
      request("/api/admin/analytics/config", {
        method: "PUT",
        body: { analytics: { enabled: true, provider: "umami", websiteId: "site-1", baseUrl: "https://analytics.example.com" } },
      })
    );
    await getOverview(request("/api/admin/analytics/overview"));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  });
});
