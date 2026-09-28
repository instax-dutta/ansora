import type { PostMeta } from "./types";

/**
 * Related-post selection: shared tags first, then recency.
 *
 * Internal linking is what keeps a blog's crawl graph connected. A one-way
 * home-to-post link means post 50 is effectively orphaned, so every post needs
 * outbound links to its peers. This is a pure function so the rule is testable.
 */
export function relatedPosts(
  all: PostMeta[],
  current: PostMeta,
  limit = 3
): PostMeta[] {
  const tags = new Set(current.tags);
  return all
    .filter(
      (post) => post.published && post.slug !== current.slug && !post.seo.noIndex
    )
    .map((post) => ({
      post,
      overlap: post.tags.filter((t) => tags.has(t)).length,
    }))
    .filter((entry) => entry.overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        (b.post.updated || b.post.date).localeCompare(a.post.updated || a.post.date)
    )
    .slice(0, limit)
    .map((entry) => entry.post);
}

/**
 * Newest/oldest neighbours for sequential navigation. Returns the posts
 * immediately before and after `current` in publication order, or null when
 * the current post is at either end.
 */
export function postNeighbours(
  all: PostMeta[],
  current: PostMeta
): { newer: PostMeta | null; older: PostMeta | null } {
  const published = all
    .filter((post) => post.published && !post.seo.noIndex)
    .sort((a, b) => b.date.localeCompare(a.date));
  const index = published.findIndex((post) => post.slug === current.slug);
  if (index === -1) return { newer: null, older: null };
  return {
    newer: index > 0 ? published[index - 1] : null,
    older: index < published.length - 1 ? published[index + 1] : null,
  };
}
