import type { AnalyticsRankedRow } from "@/lib/analytics/types";

/**
 * Traffic sources.
 *
 * "Direct / unknown" is a first-class row rather than a gap: a provider reports
 * a null referrer for direct visits, and leaving that out makes the totals look
 * like they do not add up. Bar widths are decorative — the number and the share
 * are always written out.
 */
export function SourceBreakdown({
  sources,
  title = "Traffic sources",
  emptyLabel = "No referrer data in this period.",
}: {
  sources: AnalyticsRankedRow[];
  title?: string;
  emptyLabel?: string;
}) {
  const total = sources.reduce((sum, row) => sum + row.pageviews, 0);

  return (
    <section aria-label={title} className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-serif text-lg font-semibold text-ink">{title}</h2>
      {sources.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {sources.slice(0, 8).map((row) => {
            const share = total > 0 ? Math.round((row.pageviews / total) * 100) : 0;
            return (
              <li key={row.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink" title={row.key}>
                    {row.key}
                  </span>
                  <span className="shrink-0 text-ink-muted">
                    {row.pageviews.toLocaleString("en-US")} · {share}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-soft" aria-hidden="true">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(share, 1)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {sources.length > 8 && (
        <p className="mt-3 text-xs text-ink-muted">
          Showing the top 8 of {sources.length}. Export the CSV for the full list.
        </p>
      )}
    </section>
  );
}
