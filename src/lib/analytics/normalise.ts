/**
 * Normalisation of provider payloads into the neutral shape.
 *
 * Providers change shape, omit fields and occasionally send a string where a
 * number belongs. Nothing here throws: a malformed payload degrades to nulls
 * (or an empty series) so a provider bug can never take down the dashboard or
 * the page that embeds it.
 */
import type { Granularity, TrendPoint } from "./types";

/** A finite, non-negative number, or null. Strings are *not* coerced. */
function num(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * Percent change between two periods.
 *
 * Null — not `Infinity`, not `100` — when there is no baseline. A page that
 * goes from 0 to 40 views has not "grown 4000%"; it is new, and the UI says so
 * from `changeKind`.
 */
export function percentChange(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  const a = num(current);
  const b = num(previous);
  if (a === null || b === null || b === 0) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

export type ChangeKind = "new" | "up" | "down" | "flat" | "unknown";

/** How to describe a period-over-period move, including "no prior data". */
export function changeKind(
  current: number | null | undefined,
  previous: number | null | undefined
): ChangeKind {
  const a = num(current);
  const b = num(previous);
  if (a === null || b === null) return "unknown";
  if (b === 0) return a > 0 ? "new" : "flat";
  if (a === b) return "flat";
  return a > b ? "up" : "down";
}

export interface NormalisedStats {
  pageviews: number | null;
  visitors: number | null;
  visits: number | null;
  bounces: number | null;
  engagementRate: number | null;
  averageVisitDurationSeconds: number | null;
}

/**
 * Map a provider summary object onto the neutral totals.
 *
 * `engagementRate` is derived from the provider's own visit/bounce counts and
 * is labelled "did not bounce" in the UI. It is not a universal bounce rate and
 * is never shown for a provider that does not report bounces.
 */
export function normaliseStats(payload: unknown): NormalisedStats {
  const source = isRecord(payload) ? payload : {};
  const visits = num(source.visits);
  const bounces = num(source.bounces);
  const totaltime = num(source.totaltime);

  const engagementRate =
    visits !== null && visits > 0 && bounces !== null
      ? Math.round((1 - bounces / visits) * 100)
      : null;

  const averageVisitDurationSeconds =
    visits !== null && visits > 0 && totaltime !== null
      ? Math.round(totaltime / visits)
      : null;

  return {
    pageviews: num(source.pageviews),
    visitors: num(source.visitors),
    visits,
    bounces,
    engagementRate:
      engagementRate !== null && engagementRate >= 0 && engagementRate <= 100
        ? engagementRate
        : null,
    averageVisitDurationSeconds,
  };
}

/** A series point's bucket key, or null when the value is not a date. */
function toBucketKey(value: unknown, granularity: Granularity): string | null {
  let iso: string;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    iso = date.toISOString();
  } else if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    iso = value.toISOString();
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    // Date-only input is already a bucket key.
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return granularity === "hour" ? `${trimmed}T00:00` : trimmed;
    }
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) return null;
    iso = new Date(parsed).toISOString();
  } else {
    return null;
  }

  const day = iso.slice(0, 10);
  // `YYYY-MM-DDTHH:00` rather than `…THH`: it is still a stable bucket key and
  // it is parseable, so the chart can format it without guessing.
  return granularity === "hour" ? `${day}T${iso.slice(11, 13)}:00` : day;
}

/**
 * Normalise a provider time series, ascending by bucket.
 *
 * Hourly buckets keep their hour. Collapsing them to a date would turn a 24-hour
 * window into a single bar, which looks like a data outage.
 */
export function normaliseTrend(payload: unknown, granularity: Granularity): TrendPoint[] {
  if (!isRecord(payload)) return [];
  const points = payload.pageviews;
  if (!Array.isArray(points)) return [];

  const byBucket = new Map<string, number>();
  for (const point of points) {
    if (!isRecord(point)) continue;
    const key = toBucketKey(point.x, granularity);
    if (!key) continue;
    const value = num(point.y) ?? 0;
    byBucket.set(key, (byBucket.get(key) ?? 0) + value);
  }

  return [...byBucket.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, pageviews]) => ({ date, pageviews, visitors: null }));
}

export interface DetailedRankedRow {
  key: string;
  pageviews: number;
  visitors: number | null;
  visits: number | null;
  bounces: number | null;
}

/**
 * Normalise a ranked dimension list (`[{ x, y }]`).
 *
 * A `null` label is meaningful — it is how most providers report direct
 * traffic — so it becomes an explicit label when one is supplied, rather than
 * being dropped or rendered as an empty cell.
 */
export function normaliseRankedRows(
  payload: unknown,
  options: { nullLabel?: string } = {}
): Array<{ key: string; pageviews: number }> {
  if (!Array.isArray(payload)) return [];
  const merged = new Map<string, number>();

  for (const row of payload) {
    if (!isRecord(row)) continue;
    const rawKey = row.x;
    let key: string | null;
    if (rawKey === null) {
      key = options.nullLabel ?? null;
    } else if (typeof rawKey === "string") {
      key = rawKey.trim() || null;
    } else if (typeof rawKey === "number" && Number.isFinite(rawKey)) {
      key = String(rawKey);
    } else {
      key = null;
    }
    if (!key) continue;
    merged.set(key, (merged.get(key) ?? 0) + (num(row.y) ?? 0));
  }

  return [...merged.entries()]
    .map(([key, pageviews]) => ({ key, pageviews }))
    .sort((a, b) => b.pageviews - a.pageviews || a.key.localeCompare(b.key));
}

/**
 * Normalise the expanded ranked shape (`{ x, y, visits, bounces, ... }`).
 * Falls back to the values the compact shape provides, so a provider that only
 * reports `y` still produces a usable row.
 */
export function normaliseDetailedRows(payload: unknown): DetailedRankedRow[] {
  if (!Array.isArray(payload)) return [];
  const rows: DetailedRankedRow[] = [];
  for (const row of payload) {
    if (!isRecord(row)) continue;
    const key = typeof row.x === "string" ? row.x.trim() : null;
    if (!key) continue;
    rows.push({
      key,
      pageviews: num(row.y) ?? 0,
      visitors: num(row.visitors),
      visits: num(row.visits),
      bounces: num(row.bounces),
    });
  }
  return rows.sort((a, b) => b.pageviews - a.pageviews);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
