import type { TrendPoint } from "@/lib/analytics/types";
import { formatBucket } from "./format";

/**
 * A hand-rolled SVG trend line.
 *
 * No charting dependency: the PRD's bundle budget is explicit, and a single
 * polyline does not need 60 KB of library on a page an author opens daily.
 *
 * Accessibility is not optional here. The SVG carries a sentence describing the
 * series (so a screen reader is not read a path), and the same numbers are
 * always available as a real table rather than only as a picture.
 */
export function TrendChart({
  points,
  label,
}: {
  points: TrendPoint[];
  /** e.g. "Pageviews per day" — states what is plotted and in what unit. */
  label: string;
}) {
  if (points.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
        No pageviews recorded in this period.
      </p>
    );
  }

  const width = 720;
  const height = 180;
  const padding = 8;
  const values = points.map((point) => point.pageviews);
  const max = Math.max(...values, 1);
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => {
    const x = padding + index * step;
    const y = height - padding - (point.pageviews / max) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const total = values.reduce((sum, value) => sum + value, 0);
  const peakIndex = values.indexOf(Math.max(...values));
  const summary =
    `${label}: ${total.toLocaleString("en-US")} total across ${points.length} ` +
    `${points.length === 1 ? "bucket" : "buckets"}, peak ${values[peakIndex].toLocaleString("en-US")} ` +
    `on ${formatBucket(points[peakIndex].date)}.`;

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full"
        role="img"
        aria-label={summary}
        preserveAspectRatio="none"
      >
        <polyline
          points={`${padding},${height - padding} ${coordinates.join(" ")} ${width - padding},${height - padding}`}
          className="fill-brand-soft/60"
          stroke="none"
        />
        <polyline
          points={coordinates.join(" ")}
          className="stroke-brand"
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <figcaption className="text-xs text-ink-muted">
        {label} · {total.toLocaleString("en-US")} total · peak{" "}
        {values[peakIndex].toLocaleString("en-US")} on {formatBucket(points[peakIndex].date)}
      </figcaption>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-ink-muted hover:text-ink">
          View {label.toLowerCase()} as a table
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{summary}</caption>
            <thead className="sticky top-0 bg-surface-soft">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-ink">Bucket</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink">Pageviews</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {points.map((point) => (
                <tr key={point.date}>
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-ink-muted">
                    {formatBucket(point.date)}
                  </th>
                  <td className="px-3 py-1.5 text-right text-ink">
                    {point.pageviews.toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
