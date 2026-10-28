import { describe, expect, it, vi } from "vitest";
import type { AnalyticsQuery } from "../types";
import { AnalyticsError } from "../errors";
import { UmamiProvider } from "./umami";

/**
 * Contract tests for the provider adapter, pinned to the documented Umami API
 * (GET /api/websites/{id}/stats, /pageviews, /metrics; Bearer auth).
 *
 * The behaviour that matters beyond the happy path: credential errors are
 * never retried, transient ones are retried exactly once, every failure is
 * classified, and no error message ever carries the API key.
 */

const QUERY: AnalyticsQuery = {
  from: "2026-10-01",
  to: "2026-10-30",
  timezone: "Asia/Kolkata",
  granularity: "day",
  compareToPreviousPeriod: true,
};

const KEY = "umami_super_secret_token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function provider(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return new UmamiProvider({
    apiBase: "https://analytics.example.com/api",
    websiteId: "8f2c-1",
    apiKey: KEY,
    fetchImpl,
    retryDelayMs: 0,
    ...overrides,
  });
}

const STATS = {
  pageviews: 15171,
  visitors: 4415,
  visits: 5680,
  bounces: 3567,
  totaltime: 809968,
  comparison: { pageviews: 10000, visitors: 3000, visits: 4000 },
};

describe("capabilities", () => {
  it("declares exactly what this provider can measure", async () => {
    const capabilities = await provider(vi.fn() as unknown as typeof fetch).getCapabilities();
    expect(capabilities).toEqual({
      visitors: true,
      visits: true,
      bounces: true,
      trend: true,
      sources: true,
      campaigns: true,
      // Not exposed: combining type=entry with a path filter answers a
      // different question than "visits that landed on this post".
      entryPages: false,
      hourlyGranularity: true,
    });
  });
});

describe("getOverview", () => {
  it("requests the documented stats and pageviews endpoints", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/stats")) return jsonResponse(STATS);
      return jsonResponse({
        pageviews: [{ x: "2026-10-01", y: 12 }],
        sessions: [{ x: "2026-10-01", y: 5 }],
      });
    }) as unknown as typeof fetch;

    const overview = await provider(fetchImpl).getOverview(QUERY);
    expect(overview.pageviews).toBe(15171);
    expect(overview.visitors).toBe(4415);
    expect(overview.visits).toBe(5680);
    expect(overview.trend).toEqual([
      { date: "2026-10-01", pageviews: 12, visitors: null },
    ]);
    expect(overview.previousPeriod).toEqual({
      pageviews: 10000,
      visitors: 3000,
      visits: 4000,
    });
    expect(overview.provider).toBe("umami");

    const calls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [url, init] of calls) {
      const parsed = new URL(String(url));
      expect(parsed.origin).toBe("https://analytics.example.com");
      expect(parsed.pathname.startsWith("/api/websites/8f2c-1/")).toBe(true);
      expect(parsed.searchParams.get("startDate")).toBe("2026-10-01");
      expect(parsed.searchParams.get("endDate")).toBe("2026-10-30");
      expect(parsed.searchParams.get("timezone")).toBe("Asia/Kolkata");
      expect(parsed.searchParams.get("compare")).toBe("prev");
      expect((init as RequestInit).headers).toMatchObject({
        authorization: `Bearer ${KEY}`,
      });
    }
    expect(
      calls.some(([url]) => new URL(String(url)).searchParams.get("unit") === "day")
    ).toBe(true);
  });

  it("omits the comparison when the caller disabled it", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/stats")
        ? jsonResponse({ pageviews: 3 })
        : jsonResponse({ pageviews: [] })
    ) as unknown as typeof fetch;

    const overview = await provider(fetchImpl).getOverview({
      ...QUERY,
      compareToPreviousPeriod: false,
    });
    expect(overview.previousPeriod).toBeNull();
    const calls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    for (const [url] of calls) {
      expect(new URL(String(url)).searchParams.has("compare")).toBe(false);
    }
  });

  it("asks for hourly buckets when the query is hourly", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/stats")
        ? jsonResponse({ pageviews: 1 })
        : jsonResponse({ pageviews: [] })
    ) as unknown as typeof fetch;

    await provider(fetchImpl).getOverview({ ...QUERY, granularity: "hour" });
    const calls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(
      calls.some(([url]) => new URL(String(url)).searchParams.get("unit") === "hour")
    ).toBe(true);
  });
});

describe("ranked reports", () => {
  it("asks for paths with a bounded limit", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        { x: "/blog/b", y: 2 },
        { x: "/blog/a", y: 9 },
      ])
    ) as unknown as typeof fetch;

    const rows = await provider(fetchImpl).getTopPages(QUERY, { limit: 20 });
    expect(rows).toEqual([
      { key: "/blog/a", pageviews: 9 },
      { key: "/blog/b", pageviews: 2 },
    ]);
    const url = new URL(String((fetchImpl as never as { mock: { calls: [string][] } }).mock.calls[0][0]));
    expect(url.pathname).toBe("/api/websites/8f2c-1/metrics");
    expect(url.searchParams.get("type")).toBe("path");
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("names direct traffic explicitly instead of dropping it", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([{ x: null, y: 4 }])) as unknown as typeof fetch;
    const rows = await provider(fetchImpl).getSources(QUERY);
    expect(rows).toEqual([{ key: "Direct / unknown", pageviews: 4 }]);
  });

  it("reports campaigns from the utmCampaign dimension", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([])) as unknown as typeof fetch;
    await provider(fetchImpl).getCampaigns(QUERY);
    const url = new URL(
      String((fetchImpl as never as { mock: { calls: [string][] } }).mock.calls[0][0])
    );
    expect(url.searchParams.get("type")).toBe("utmCampaign");
  });
});

describe("getPagePerformance", () => {
  it("filters the series, stats and sources by the post path", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/stats")) {
        return jsonResponse({ pageviews: 40, visits: 30, comparison: { pageviews: 20 } });
      }
      if (url.pathname.endsWith("/pageviews")) {
        return jsonResponse({
          pageviews: [{ x: "2026-10-01", y: 40 }],
          compare: { pageviews: [{ x: "2026-09-01", y: 20 }] },
        });
      }
      return jsonResponse([{ x: "news.ycombinator.com", y: 40 }]);
    }) as unknown as typeof fetch;

    const performance = await provider(fetchImpl).getPagePerformance("/blog/a", QUERY);
    expect(performance.path).toBe("/blog/a");
    expect(performance.pageviews).toBe(40);
    expect(performance.previousPageviews).toBe(20);
    expect(performance.change).toBe(100);
    expect(performance.sources).toEqual([{ key: "news.ycombinator.com", pageviews: 40 }]);

    const calls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    for (const [url] of calls) {
      expect(new URL(String(url)).searchParams.get("path")).toBe("/blog/a");
    }
  });
});

describe("healthCheck", () => {
  it("reports a reachable provider with measured latency", async () => {
    const times = [100, 137];
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "8f2c-1", name: "Blog" })) as unknown as typeof fetch;

    const health = await provider(fetchImpl, { now: () => times.shift() ?? 137 }).healthCheck();
    expect(health.ok).toBe(true);
    expect(health.provider).toBe("umami");
    expect(health.latencyMs).toBe(37);
    expect(health.error).toBeNull();
    expect(Number.isNaN(Date.parse(health.checkedAt))).toBe(false);
  });

  it("classifies a credential failure and never retries it", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "unauthorized" }, 401)) as unknown as typeof fetch;

    const health = await provider(fetchImpl).healthCheck();
    expect(health.ok).toBe(false);
    expect(health.error?.code).toBe("unauthorized");
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
    expect(JSON.stringify(health)).not.toContain(KEY);
  });
});

describe("failure handling", () => {
  it("retries a rate-limited request exactly once", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse([{ x: "/blog/a", y: 1 }])) as unknown as typeof fetch;

    const rows = await provider(fetchImpl).getTopPages(QUERY);
    expect(rows).toEqual([{ key: "/blog/a", pageviews: 1 }]);
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2);
  });

  it("gives up after one retry on a server error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 502)) as unknown as typeof fetch;

    await expect(provider(fetchImpl).getTopPages(QUERY)).rejects.toMatchObject({
      code: "server_error",
    });
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2);
  });

  it("does not retry a bad request", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 400)) as unknown as typeof fetch;

    await expect(provider(fetchImpl).getTopPages(QUERY)).rejects.toMatchObject({
      code: "bad_response",
    });
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
  });

  it("classifies a network failure as unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    await expect(provider(fetchImpl).getTopPages(QUERY)).rejects.toMatchObject({
      code: "unreachable",
    });
  });

  it("aborts a hanging provider and reports a timeout", async () => {
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        })
    ) as unknown as typeof fetch;

    await expect(
      provider(fetchImpl, { timeoutMs: 10 }).getTopPages(QUERY)
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("treats a non-JSON body as a bad response", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("<html>oops</html>", { status: 200 })
    ) as unknown as typeof fetch;

    await expect(provider(fetchImpl).getTopPages(QUERY)).rejects.toMatchObject({
      code: "bad_response",
    });
  });

  it("never puts the API key in an error message", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 401)) as unknown as typeof fetch;
    try {
      await provider(fetchImpl).getTopPages(QUERY);
      throw new Error("expected a rejection");
    } catch (err) {
      expect(err).toBeInstanceOf(AnalyticsError);
      expect(String((err as Error).message)).not.toContain(KEY);
      expect(String((err as Error).message)).toMatch(/401/);
    }
  });

  it("keeps the website id out of the request path unescaped", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([])) as unknown as typeof fetch;
    await provider(fetchImpl, { websiteId: "../../etc/passwd" }).getTopPages(QUERY);
    const url = new URL(
      String((fetchImpl as never as { mock: { calls: [string][] } }).mock.calls[0][0])
    );
    expect(url.pathname).toBe("/api/websites/..%2F..%2Fetc%2Fpasswd/metrics");
  });
});
