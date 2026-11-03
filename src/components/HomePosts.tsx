"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Pagination } from "./Pagination";
import { PostCard, type PostCardData } from "./PostCard";

/**
 * Client-side pagination for the home page.
 *
 * The home page is statically rendered so a visit costs no function time. The
 * `?page=N` URLs existing blogs have indexed still work: page 1 is in the
 * static HTML, and this component swaps in the requested slice after mount.
 *
 * Deliberate choices:
 * - The page number comes from `useSyncExternalStore`, not `useSearchParams`,
 *   so the static HTML keeps the full first page instead of being replaced by
 *   a Suspense fallback (which would hide every post from crawlers). The server
 *   snapshot is page 1, so hydration matches.
 * - Pagination links are real anchors (`hardNavigation`), so a page change is
 *   a fresh request for a static file and the new query is always read.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function getSnapshot(): number {
  const raw = Number.parseInt(
    new URLSearchParams(window.location.search).get("page") ?? "1",
    10
  );
  return Number.isFinite(raw) && raw > 1 ? raw : 1;
}

function getServerSnapshot(): number {
  return 1;
}

export function HomePosts({
  posts,
  pageSize,
  children,
}: {
  posts: PostCardData[];
  pageSize: number;
  children: React.ReactNode;
}) {
  const page = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const extra = page > 1 ? posts.slice((page - 1) * pageSize, page * pageSize) : [];

  return (
    <>
      <div className={page === 1 ? undefined : "hidden"}>{children}</div>

      {page > 1 &&
        (extra.length > 0 ? (
          <section
            aria-label="Posts"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {extra.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </section>
        ) : (
          <p className="text-ink-muted">
            No posts on this page.{" "}
            <Link href="/blog" className="text-brand hover:underline">
              See all posts
            </Link>
            .
          </p>
        ))}

      <Pagination page={page} totalPages={totalPages} hardNavigation />
    </>
  );
}
