import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCacheKey, cachedAnalytics, clearAnalyticsCache } from "./cache";

/**
 * The cache exists to reduce provider API calls, which are rate limited. That
 * makes the key a correctness surface: mixing two sites or two date ranges in
 * one entry shows one blog's traffic in another blog's dashboard.
 */
describe("analyticsCacheKey", () => {
  const base = {
    provider: "umami",
    websiteId: "site-a",
    from: "2026-10-01",
    to: "2026-10-30",
    timezone: "Asia/Kolkata",
    granularity: "day",
    kind: "overview",
  };

  it("is stable for the same inputs regardless of property order", () => {
    const reordered = {
      kind: "overview",
      granularity: "day",
      timezone: "Asia/Kolkata",
      to: "2026-10-30",
      from: "2026-10-01",
      websiteId: "site-a",
      provider: "umami",
    };
    expect(analyticsCacheKey(base)).toBe(analyticsCacheKey(reordered));
  });

  it("isolates every dimension that changes the answer", () => {
    const keys = new Set([
      analyticsCacheKey(base),
      analyticsCacheKey({ ...base, websiteId: "site-b" }),
      analyticsCacheKey({ ...base, provider: "plausible" }),
      analyticsCacheKey({ ...base, from: "2026-09-01" }),
      analyticsCacheKey({ ...base, to: "2026-10-31" }),
      analyticsCacheKey({ ...base, timezone: "UTC" }),
      analyticsCacheKey({ ...base, granularity: "hour" }),
      analyticsCacheKey({ ...base, kind: "pages" }),
      analyticsCacheKey({ ...base, path: "/blog/x" }),
    ]);
    expect(keys.size).toBe(9);
  });
});

describe("cachedAnalytics", () => {
  afterEach(() => {
    clearAnalyticsCache();
    vi.useRealTimers();
  });

  it("serves a second call from memory", async () => {
    const load = vi.fn().mockResolvedValue({ pageviews: 1 });
    const key = analyticsCacheKey({ kind: "overview", websiteId: "a" });

    expect(await cachedAnalytics(key, load, { ttlMs: 60_000 })).toEqual({ pageviews: 1 });
    expect(await cachedAnalytics(key, load, { ttlMs: 60_000 })).toEqual({ pageviews: 1 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent requests for the same key", async () => {
    const load = vi.fn(
      () => new Promise<number>((resolve) => setTimeout(() => resolve(7), 5))
    );
    const key = analyticsCacheKey({ kind: "overview", websiteId: "a" });

    const results = await Promise.all([
      cachedAnalytics(key, load),
      cachedAnalytics(key, load),
      cachedAnalytics(key, load),
    ]);

    expect(results).toEqual([7, 7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("expires after the TTL", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const key = analyticsCacheKey({ kind: "overview", websiteId: "a" });

    expect(await cachedAnalytics(key, load, { ttlMs: 1_000 })).toBe(1);
    vi.advanceTimersByTime(1_001);
    expect(await cachedAnalytics(key, load, { ttlMs: 1_000 })).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not cache a rejection, so a transient failure is retried", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("provider down"))
      .mockResolvedValueOnce("ok");
    const key = analyticsCacheKey({ kind: "overview", websiteId: "a" });

    await expect(cachedAnalytics(key, load)).rejects.toThrow("provider down");
    await expect(cachedAnalytics(key, load)).resolves.toBe("ok");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
