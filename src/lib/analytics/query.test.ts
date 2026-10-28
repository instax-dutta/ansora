import { describe, expect, it } from "vitest";
import {
  MAX_RANGE_DAYS,
  addDays,
  dayCount,
  isIsoDate,
  isValidTimeZone,
  parseAnalyticsQuery,
  previousPeriod,
  todayInZone,
} from "./query";

/**
 * Date and range handling is the least glamorous part of analytics and the
 * place where "30 days" quietly means three different things. These tests pin
 * the semantics: calendar strings in the site's timezone, inclusive bounds,
 * equal-length comparison windows, and a hard cap on what a caller can ask a
 * provider for.
 */

const NOW = new Date("2026-10-26T12:00:00Z");

describe("isValidTimeZone", () => {
  it("accepts IANA zones", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects nonsense and empty values", () => {
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("../../etc/passwd")).toBe(false);
  });
});

describe("todayInZone", () => {
  it("uses the calendar day in the requested zone, not UTC", () => {
    // 20:00Z is already the next day in IST.
    expect(todayInZone("Asia/Kolkata", NOW)).toBe("2026-10-26");
    expect(todayInZone("America/Los_Angeles", NOW)).toBe("2026-10-26");
    expect(todayInZone("Asia/Kolkata", new Date("2026-10-25T20:00:00Z"))).toBe(
      "2026-10-26"
    );
    expect(todayInZone("America/Los_Angeles", new Date("2026-10-25T20:00:00Z"))).toBe(
      "2026-10-25"
    );
  });

  it("falls back to UTC for an unknown zone rather than throwing", () => {
    expect(todayInZone("Nowhere/Nothing", new Date("2026-10-26T23:30:00Z"))).toBe(
      "2026-10-26"
    );
  });
});

describe("calendar arithmetic", () => {
  it("adds days without drifting across a DST transition", () => {
    // US DST starts on 2026-03-08; adding calendar days must not lose one.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDays("2026-03-31", 1)).toBe("2026-04-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("counts inclusive days across a DST boundary", () => {
    expect(dayCount("2026-03-01", "2026-03-31")).toBe(31);
    expect(dayCount("2026-10-26", "2026-10-26")).toBe(1);
  });

  it("only accepts real calendar dates", () => {
    expect(isIsoDate("2026-10-26")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("26-10-2026")).toBe(false);
    expect(isIsoDate("2026-10-26T00:00:00Z")).toBe(false);
  });
});

describe("previousPeriod", () => {
  it("returns an equal-length window immediately before the current one", () => {
    expect(previousPeriod("2026-10-01", "2026-10-30")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(previousPeriod("2026-10-26", "2026-10-26")).toEqual({
      from: "2026-10-25",
      to: "2026-10-25",
    });
  });

  it("keeps the two windows the same number of days", () => {
    const current = { from: "2026-03-01", to: "2026-03-31" };
    const previous = previousPeriod(current.from, current.to);
    expect(dayCount(previous.from, previous.to)).toBe(
      dayCount(current.from, current.to)
    );
  });
});

describe("parseAnalyticsQuery", () => {
  const parse = (query: string, opts = {}) =>
    parseAnalyticsQuery(new URLSearchParams(query), {
      timezone: "Asia/Kolkata",
      now: NOW,
      ...opts,
    });

  it("defaults to the last 30 days in the site timezone", () => {
    const result = parse("");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query).toEqual({
      from: "2026-09-27",
      to: "2026-10-26",
      timezone: "Asia/Kolkata",
      granularity: "day",
      compareToPreviousPeriod: true,
    });
  });

  it("honours a preset number of days", () => {
    const result = parse("days=7");
    expect(result.ok && result.query.from).toBe("2026-10-20");
    expect(result.ok && result.query.to).toBe("2026-10-26");
  });

  it("uses hourly granularity for a single-day window", () => {
    const result = parse("days=1");
    expect(result.ok && result.query.granularity).toBe("hour");
    expect(result.ok && result.query.from).toBe("2026-10-26");
  });

  it("accepts an explicit custom range and keeps the bounds inclusive", () => {
    const result = parse("from=2026-08-01&to=2026-08-31");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.from).toBe("2026-08-01");
    expect(result.query.to).toBe("2026-08-31");
    expect(result.query.granularity).toBe("day");
  });

  it("lets the caller disable the comparison period", () => {
    const result = parse("compare=false");
    expect(result.ok && result.query.compareToPreviousPeriod).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(parse("from=2026-02-30&to=2026-03-01")).toEqual({
      ok: false,
      error: "Dates must use YYYY-MM-DD.",
    });
  });

  it("rejects an inverted range", () => {
    expect(parse("from=2026-10-10&to=2026-10-01")).toEqual({
      ok: false,
      error: "The start date must be on or before the end date.",
    });
  });

  it("rejects an unbounded range", () => {
    const result = parse(`from=2020-01-01&to=2026-10-26`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(String(MAX_RANGE_DAYS));
  });

  it("rejects out-of-bounds and non-numeric day presets", () => {
    for (const value of ["0", "-7", "abc", "1.5", "4000"]) {
      const result = parse(`days=${value}`);
      expect(result.ok, `days=${value}`).toBe(false);
    }
  });

  it("rejects an invalid timezone instead of silently using UTC", () => {
    const result = parse("timezone=Mars/Olympus_Mons");
    expect(result).toEqual({ ok: false, error: "Unknown timezone." });
  });

  it("rejects a hostile or absolute path filter", () => {
    for (const value of [
      "https://evil.example.com/blog/x",
      "//evil.example.com/x",
      "/blog/../admin",
      "blog/no-leading-slash",
      "/blog/x?utm_source=newsletter",
      "/blog/x#frag",
    ]) {
      const result = parse(`path=${encodeURIComponent(value)}`);
      expect(result.ok, value).toBe(false);
    }
  });

  it("accepts a normal site pathname", () => {
    const result = parse(`path=${encodeURIComponent("/blog/self-hosting")}`);
    expect(result.ok && result.query.path).toBe("/blog/self-hosting");
  });

  it("ignores unknown parameters", () => {
    const result = parse("evil=1&days=7");
    expect(result.ok).toBe(true);
  });
});
