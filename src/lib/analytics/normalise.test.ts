import { describe, expect, it } from "vitest";
import {
  normaliseRankedRows,
  normaliseStats,
  normaliseTrend,
  percentChange,
  changeKind,
} from "./normalise";

/**
 * Provider payloads lie in small, ordinary ways: a missing key, a string where
 * a number belongs, a null rank label for direct traffic. Normalisation turns
 * that into a shape the UI can render honestly — and, critically, keeps
 * "not provided" distinguishable from "zero".
 */

describe("percentChange", () => {
  it("computes a rounded percentage change", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 200)).toBe(-75);
    expect(percentChange(100, 100)).toBe(0);
  });

  it("returns null instead of infinity when there is no baseline", () => {
    expect(percentChange(120, 0)).toBeNull();
    expect(percentChange(120, null)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });

  it("returns null for missing or unusable values", () => {
    expect(percentChange(null, 10)).toBeNull();
    expect(percentChange(Number.NaN, 10)).toBeNull();
    expect(percentChange(10, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("changeKind", () => {
  it("distinguishes a brand-new page from a flat one and from no data", () => {
    expect(changeKind(120, 0)).toBe("new");
    expect(changeKind(100, 100)).toBe("flat");
    expect(changeKind(150, 100)).toBe("up");
    expect(changeKind(50, 100)).toBe("down");
    expect(changeKind(null, 100)).toBe("unknown");
    expect(changeKind(0, null)).toBe("unknown");
  });
});

describe("normaliseStats", () => {
  it("maps the documented provider stats shape", () => {
    const stats = normaliseStats({
      pageviews: 15171,
      visitors: 4415,
      visits: 5680,
      bounces: 3567,
      totaltime: 809968,
    });
    expect(stats.pageviews).toBe(15171);
    expect(stats.visitors).toBe(4415);
    expect(stats.visits).toBe(5680);
    expect(stats.bounces).toBe(3567);
    // 809968 / 5680 ≈ 143s
    expect(stats.averageVisitDurationSeconds).toBe(143);
    // 1 - 3567/5680 ≈ 37% did not bounce
    expect(stats.engagementRate).toBe(37);
  });

  it("keeps unsupported metrics null rather than zero", () => {
    const stats = normaliseStats({ pageviews: 5 });
    expect(stats.pageviews).toBe(5);
    expect(stats.visitors).toBeNull();
    expect(stats.visits).toBeNull();
    expect(stats.bounces).toBeNull();
    expect(stats.averageVisitDurationSeconds).toBeNull();
    expect(stats.engagementRate).toBeNull();
  });

  it("survives malformed payloads without throwing", () => {
    for (const payload of [null, undefined, 42, "nope", [], { pageviews: "lots" }]) {
      const stats = normaliseStats(payload);
      expect(stats.pageviews).toBe(null);
      expect(stats.visitors).toBe(null);
    }
  });

  it("treats negative and non-finite numbers as absent", () => {
    const stats = normaliseStats({ pageviews: -1, visitors: Number.NaN, visits: 0 });
    expect(stats.pageviews).toBeNull();
    expect(stats.visitors).toBeNull();
    expect(stats.visits).toBe(0);
  });
});

describe("normaliseTrend", () => {
  it("maps a daily series in ascending date order", () => {
    const trend = normaliseTrend(
      {
        pageviews: [
          { x: "2026-10-02", y: 26 },
          { x: "2026-10-01", y: 12 },
        ],
      },
      "day"
    );
    expect(trend).toEqual([
      { date: "2026-10-01", pageviews: 12, visitors: null },
      { date: "2026-10-02", pageviews: 26, visitors: null },
    ]);
  });

  it("keeps the hour for hourly series so a 24h window does not collapse", () => {
    const trend = normaliseTrend(
      {
        pageviews: [
          { x: "2026-10-26T02:00:00Z", y: 4 },
          { x: "2026-10-26T01:00:00Z", y: 9 },
        ],
      },
      "hour"
    );
    expect(trend.map((point) => point.date)).toEqual([
      "2026-10-26T01:00",
      "2026-10-26T02:00",
    ]);
    expect(trend[1].pageviews).toBe(4);
  });

  it("accepts epoch milliseconds and drops unusable points", () => {
    const trend = normaliseTrend(
      {
        pageviews: [
          { x: Date.parse("2026-10-01T00:00:00Z"), y: 3 },
          { x: null, y: 5 },
          { x: "not a date", y: 1 },
          { x: "2026-10-02", y: Number.NaN },
        ],
      },
      "day"
    );
    expect(trend).toEqual([
      { date: "2026-10-01", pageviews: 3, visitors: null },
      { date: "2026-10-02", pageviews: 0, visitors: null },
    ]);
  });

  it("returns an empty series for an empty or malformed payload", () => {
    expect(normaliseTrend({ pageviews: [] }, "day")).toEqual([]);
    expect(normaliseTrend(null, "day")).toEqual([]);
    expect(normaliseTrend({ sessions: [{ x: "2026-10-01", y: 2 }] }, "day")).toEqual([]);
  });
});

describe("normaliseRankedRows", () => {
  it("reads the documented ranked-row shape", () => {
    expect(
      normaliseRankedRows([
        { x: "/blog/b", y: 10 },
        { x: "/blog/a", y: 30 },
      ])
    ).toEqual([
      { key: "/blog/a", pageviews: 30 },
      { key: "/blog/b", pageviews: 10 },
    ]);
  });

  it("names a missing dimension explicitly instead of dropping the row", () => {
    expect(normaliseRankedRows([{ x: null, y: 7 }], { nullLabel: "Direct / unknown" })).toEqual([
      { key: "Direct / unknown", pageviews: 7 },
    ]);
  });

  it("merges duplicate labels and ignores junk", () => {
    const rows = normaliseRankedRows([
      { x: "google.com", y: 5 },
      { x: "google.com", y: 6 },
      { x: "   ", y: 1 },
      null,
      { y: 9 },
      { x: "x", y: "many" },
    ]);
    expect(rows).toEqual([
      { key: "google.com", pageviews: 11 },
      { key: "x", pageviews: 0 },
    ]);
  });
});
