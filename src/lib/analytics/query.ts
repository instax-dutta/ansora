/**
 * Query validation for every analytics read.
 *
 * Everything here is bounded on purpose. The provider API is rate limited and
 * the report is authenticated, but an unbounded `from` is still a way to make
 * one dashboard request consume a day's quota. Dates are calendar strings in
 * the site's timezone — not timestamps — because that is what the author means
 * by "last 30 days", and because it keeps DST out of the arithmetic.
 */
import type { AnalyticsQuery, Granularity } from "./types";

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;
export const DEFAULT_TIMEZONE = "UTC";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PATH_LENGTH = 512;

/** A preset the dashboard can offer, in days. */
export const RANGE_PRESETS = [
  { id: "1d", days: 1, label: "24 hours" },
  { id: "7d", days: 7, label: "7 days" },
  { id: "30d", days: 30, label: "30 days" },
  { id: "90d", days: 90, label: "90 days" },
] as const;

/** Is this a usable IANA timezone name? `Intl` is the only honest oracle. */
export function isValidTimeZone(timezone: string): boolean {
  if (!timezone || timezone.length > 64) return false;
  // A path-looking value is not a timezone; reject before touching Intl.
  if (timezone.includes("/..") || timezone.startsWith(".")) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Today's calendar date in `timezone`.
 *
 * `en-CA` formats as `YYYY-MM-DD`, which is exactly the wire format we need and
 * avoids string surgery on a localised date.
 */
export function todayInZone(timezone: string, now: Date = new Date()): string {
  const zone = isValidTimeZone(timezone) ? timezone : DEFAULT_TIMEZONE;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** True for a real `YYYY-MM-DD` calendar date (rejects `2026-02-30`). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Calendar-day arithmetic in UTC.
 *
 * Calendar strings have no time component, so UTC is the correct frame: adding
 * one day is one day even on a 23- or 25-hour DST transition day.
 */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** Inclusive day count between two calendar dates. */
export function dayCount(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * The comparison window: the same number of days, immediately before `from`.
 *
 * Equal length matters more than it looks. Comparing 30 days against "last
 * month" (28-31 days) makes every month-over-month number slightly wrong, and
 * the author has no way to see why.
 */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const days = dayCount(from, to);
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, -(Math.max(days, 1) - 1));
  return { from: previousFrom, to: previousTo };
}

/**
 * Validate a caller-supplied path filter.
 *
 * A pathname only: no origin, credentials, query string, hash or traversal. The
 * query string ban is a privacy rule as much as a correctness one — it is where
 * emails, tokens and search terms end up.
 */
export function sanitisePathParam(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > MAX_PATH_LENGTH) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[:?#\\\s`]/.test(value)) return null;
  const segments = value.split("/");
  if (segments.some((segment) => segment === ".." || segment === ".")) return null;
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

export type QueryResult =
  | { ok: true; query: AnalyticsQuery }
  | { ok: false; error: string };

/**
 * Parse and bound a report request.
 *
 * Accepts either `days=N` or an explicit `from`/`to` pair. Everything else is
 * validated, never trusted: unknown parameters are ignored, malformed ones are
 * rejected with a message that is safe to render.
 */
export function parseAnalyticsQuery(
  params: URLSearchParams,
  options: { timezone?: string; now?: Date } = {}
): QueryResult {
  const rawTimezone = params.get("timezone") ?? options.timezone ?? DEFAULT_TIMEZONE;
  if (!isValidTimeZone(rawTimezone)) {
    return { ok: false, error: "Unknown timezone." };
  }
  const timezone = rawTimezone;
  const now = options.now ?? new Date();

  const rawFrom = params.get("from");
  const rawTo = params.get("to");
  let from: string;
  let to: string;
  let days: number;

  if (rawFrom !== null || rawTo !== null) {
    if (!rawFrom || !rawTo || !isIsoDate(rawFrom) || !isIsoDate(rawTo)) {
      return { ok: false, error: "Dates must use YYYY-MM-DD." };
    }
    if (fromMoreThanTo(rawFrom, rawTo)) {
      return { ok: false, error: "The start date must be on or before the end date." };
    }
    days = dayCount(rawFrom, rawTo);
    if (days > MAX_RANGE_DAYS) {
      return {
        ok: false,
        error: `The range is too long. Choose ${MAX_RANGE_DAYS} days or fewer.`,
      };
    }
    from = rawFrom;
    to = rawTo;
  } else {
    const rawDays = params.get("days");
    if (rawDays !== null) {
      const parsed = Number(rawDays);
      if (
        !Number.isInteger(parsed) ||
        parsed < 1 ||
        parsed > MAX_RANGE_DAYS ||
        !/^\d+$/.test(rawDays.trim())
      ) {
        return {
          ok: false,
          error: `Days must be a whole number between 1 and ${MAX_RANGE_DAYS}.`,
        };
      }
      days = parsed;
    } else {
      days = DEFAULT_RANGE_DAYS;
    }
    to = todayInZone(timezone, now);
    from = addDays(to, -(days - 1));
  }

  const rawGranularity = params.get("granularity");
  const granularity: Granularity =
    rawGranularity === "hour" || rawGranularity === "day"
      ? rawGranularity
      : days <= 2
        ? "hour"
        : "day";
  if (rawGranularity !== null && rawGranularity !== "hour" && rawGranularity !== "day") {
    return { ok: false, error: "Granularity must be hour or day." };
  }

  const rawPath = params.get("path");
  let path: string | undefined;
  if (rawPath !== null && rawPath !== "") {
    const cleaned = sanitisePathParam(rawPath);
    if (!cleaned) {
      return {
        ok: false,
        error: "The path filter must be a site path such as /blog/my-post.",
      };
    }
    path = cleaned;
  }

  return {
    ok: true,
    query: {
      from,
      to,
      timezone,
      granularity,
      compareToPreviousPeriod: params.get("compare") !== "false",
      ...(path ? { path } : {}),
    },
  };
}

/** `from` is after `to`. Kept separate so the comparison reads like the rule. */
function fromMoreThanTo(from: string, to: string): boolean {
  return from > to;
}
