import { listStatus } from "@/lib/content";

/**
 * Shown when the public post listing degraded because the content store could
 * not be reached.
 *
 * This is the counterpart to `safeListPosts()` returning `[]`. Without it, a
 * rate limit or a transient API failure renders as "Nothing published yet" —
 * which reads to an author as "my blog is gone" and to a crawler as "this site
 * has no content". Both are catastrophically misleading, and the second one is
 * how a site gets dropped from an index.
 *
 * It renders only for a *failed* listing, never for a genuinely empty blog.
 */
export function ContentUnavailable() {
  const status = listStatus();
  if (status.ok) return null;

  return (
    <div
      role="status"
      className="rounded-2xl border border-line border-l-4 border-l-brand bg-surface p-8"
    >
      <h2 className="font-serif text-xl font-semibold text-ink">
        Posts are temporarily unavailable
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Your posts are safe in git. This page could not reach the content store
        just now, so it is showing an empty listing rather than your articles.
        It will recover on its own as soon as the store responds again.
      </p>
      {status.reason && (
        <p className="mt-3 font-mono text-xs text-ink-muted">
          Reason: {status.reason}
        </p>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        Nothing has been deleted. If this persists, check that the deployment
        still has valid content-store credentials and is not rate limited.
      </p>
    </div>
  );
}
