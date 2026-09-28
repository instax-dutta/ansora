import Link from "next/link";

/**
 * Sequential pagination.
 *
 * `rel="prev"` / `rel="next"` are emitted as `<link>` elements via a rendered
 * fragment so crawlers can walk the pagination graph instead of inferring it
 * from in-page anchors. Combined with the self-referencing canonical on each
 * page, this removes the duplicate-URL problem `?page=N` used to create.
 */
export function Pagination({
  page,
  totalPages,
  basePath = "/",
}: {
  page: number;
  totalPages: number;
  basePath?: string;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => (p <= 1 ? basePath : `${basePath}?page=${p}`);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <>
      <link rel="prev" href={hrefFor(page - 1)} />
      {hasNext && <link rel="next" href={hrefFor(page + 1)} />}

      <nav
        aria-label="Pagination"
        className="mt-12 flex items-center justify-between gap-4 border-t border-line pt-6"
      >
        {hasPrev ? (
          <Link
            href={hrefFor(page - 1)}
            rel="prev"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:text-brand"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Newer posts
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}

        <span className="text-sm text-ink-muted">
          Page {page} of {totalPages}
        </span>

        {hasNext ? (
          <Link
            href={hrefFor(page + 1)}
            rel="next"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:text-brand"
          >
            Older posts
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
      </nav>
    </>
  );
}
