"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AnalyticsPageRow } from "@/lib/analytics/types";
import { changeDisplay, formatMetric, postReportHref } from "./format";

type SortKey = "views" | "change" | "date";

const PAGE_SIZE = 10;

/**
 * Top content.
 *
 * Bounded and paginated: the provider was asked for at most 100 rows and the
 * table shows ten at a time, because a list of every path on the site is a
 * table nobody reads and a query nobody should pay for.
 *
 * Draft paths can appear as rows (they are real requests) but never carry a
 * title or a link — the mapper withholds the post, so nothing here can confirm
 * an unpublished slug.
 */
export function TopContentTable({
  rows,
  csvHref,
  hasComparison,
}: {
  rows: AnalyticsPageRow[];
  csvHref: string;
  hasComparison: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("views");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? rows.filter(
          (row) =>
            row.path.toLowerCase().includes(needle) ||
            (row.post?.title ?? "").toLowerCase().includes(needle)
        )
      : rows;

    const sorted = [...matches];
    if (sort === "views") sorted.sort((a, b) => b.pageviews - a.pageviews);
    if (sort === "change") {
      sorted.sort((a, b) => (b.change ?? Number.NEGATIVE_INFINITY) - (a.change ?? Number.NEGATIVE_INFINITY));
    }
    if (sort === "date") {
      sorted.sort((a, b) => (b.post?.updated ?? "").localeCompare(a.post?.updated ?? ""));
    }
    return sorted;
  }, [rows, query, sort]);

  const shown = filtered.slice(0, visible);

  return (
    <section
      aria-label="Top content"
      className="rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-ink">Top content</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="content-search" className="sr-only">
            Search content
          </label>
          <input
            id="content-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search title or path…"
            className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm text-ink outline-none focus:border-brand"
          />
          <label htmlFor="content-sort" className="sr-only">
            Sort content
          </label>
          <select
            id="content-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
          >
            <option value="views">Most views</option>
            {hasComparison && <option value="change">Biggest change</option>}
            <option value="date">Recently updated</option>
          </select>
          <a
            href={csvHref}
            className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            Export CSV
          </a>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">
          No pageviews recorded in this period.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Nothing matches “{query}”.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
                  <th scope="col" className="py-2.5 pr-3 font-semibold">Page</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Views</th>
                  {hasComparison && (
                    <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Change</th>
                  )}
                  <th scope="col" className="py-2.5 pr-3 font-semibold">Last updated</th>
                  <th scope="col" className="py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((row) => {
                  const change = changeDisplay(row.change);
                  return (
                    <tr key={row.path} className="transition-colors hover:bg-surface-soft/60">
                      <th scope="row" className="max-w-[22rem] py-2.5 pr-3 text-left font-normal">
                        {row.post ? (
                          <>
                            <Link
                              href={postReportHref(row.post.slug)}
                              className="font-medium text-ink transition-colors hover:text-brand"
                            >
                              {row.post.title || row.post.slug}
                            </Link>
                            <span className="mt-0.5 block truncate font-mono text-xs text-ink-muted">
                              {row.path}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-ink-muted">
                              {row.kind === "other" ? "Other page" : row.kind}
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-xs text-ink-muted">
                              {row.path}
                            </span>
                          </>
                        )}
                        {row.post?.noIndex && (
                          <span className="mt-1 inline-block rounded-full bg-surface-soft px-2 py-0.5 text-xs text-ink-muted">
                            no-index
                          </span>
                        )}
                      </th>
                      <td className="py-2.5 pr-3 text-right font-medium text-ink">
                        {formatMetric(row.pageviews)}
                      </td>
                      {hasComparison && (
                        <td className="py-2.5 pr-3 text-right">
                          <span className="whitespace-nowrap text-ink-muted">
                            <span aria-hidden="true">{change.arrow}</span>{" "}
                            {change.label === "—" ? "—" : change.label}
                            <span className="sr-only">, {change.description}</span>
                          </span>
                        </td>
                      )}
                      <td className="py-2.5 pr-3 text-ink-muted">
                        {row.post?.updated ? row.post.updated.slice(0, 10) : "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        {row.post ? (
                          <Link
                            href={postReportHref(row.post.slug)}
                            className="text-sm font-medium text-brand hover:underline"
                          >
                            Performance
                          </Link>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > shown.length && (
            <button
              type="button"
              onClick={() => setVisible((current) => current + PAGE_SIZE)}
              className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
            >
              Show {Math.min(PAGE_SIZE, filtered.length - shown.length)} more
            </button>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            Showing {shown.length} of {filtered.length}
            {filtered.length !== rows.length ? ` (${rows.length} total)` : ""}.
          </p>
        </>
      )}
    </section>
  );
}
