/**
 * Presentation helpers for analytics numbers.
 *
 * The rule that this file enforces everywhere: `null` renders as an em dash
 * with a "not reported" note, never as `0`. A provider that does not measure
 * unique visitors must not make an author think nobody read their post.
 */

/** Numbers only appear when they exist. `null` is visibly unknown. */
export function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US");
}

export function isUnreported(value: number | null | undefined): boolean {
  return value === null || value === undefined || !Number.isFinite(value);
}

export interface ChangeDisplay {
  /** Rendered text, e.g. `+40%`, `−12%`, `New`, `—`. */
  label: string;
  /** Direction, also carried by a glyph so it is never colour-only. */
  arrow: string;
  tone: "up" | "down" | "flat" | "unknown";
  /** Screen-reader sentence. */
  description: string;
}

export function changeDisplay(change: number | null | undefined): ChangeDisplay {
  if (change === null || change === undefined || !Number.isFinite(change)) {
    return { label: "—", arrow: "", tone: "unknown", description: "No comparison data" };
  }
  if (change === 0) {
    return { label: "0%", arrow: "→", tone: "flat", description: "No change" };
  }
  const magnitude = Math.abs(Math.round(change * 10) / 10);
  const label = `${magnitude}%`;
  if (change > 0) {
    return { label, arrow: "▲", tone: "up", description: `up ${label} versus the previous period` };
  }
  return { label, arrow: "▼", tone: "down", description: `down ${label} versus the previous period` };
}

/**
 * A change against a period with no baseline.
 *
 * Kept separate from `changeDisplay` because "new" is not "flat" and not "+∞":
 * a page that did not exist last month has no percentage change.
 */
export function newOrChange(
  change: number | null | undefined,
  current: number | null | undefined,
  previous: number | null | undefined
): ChangeDisplay {
  if ((previous === 0 || previous === null || previous === undefined) && (current ?? 0) > 0) {
    return { label: "New", arrow: "★", tone: "up", description: "New in this period" };
  }
  return changeDisplay(change);
}

/** `2026-10-01` or `2026-10-01T14:00` → a short, human label. */
export function formatBucket(date: string): string {
  const day = date.slice(0, 10);
  if (date.length > 10) {
    const hour = date.slice(11, 13);
    return `${day} ${hour}:00`;
  }
  return day;
}

/** Timestamp of a provider fetch, in the viewer's locale. */
export function formatFetchedAt(iso: string | null | undefined): string {
  if (!iso) return "never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** A per-post page path link to the post's own report. */
export function postReportHref(slug: string): string {
  return `/admin/analytics/posts/${encodeURIComponent(slug)}`;
}
