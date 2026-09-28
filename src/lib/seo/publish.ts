import type { PostMeta } from "@/lib/content/types";

/**
 * Visibility policy shared by every machine-discovery surface.
 *
 * Two distinct gates, deliberately not merged:
 *
 * - `published` — a human-visibility switch. Unpublished posts are drafts and
 *   must never appear anywhere public (root rule).
 * - `seo.noIndex` — a search-visibility opt-out. The post stays on the site and
 *   in the human listings, but must not be advertised to crawlers or
 *   syndicated to subscribers, because a no-index page that is linked from a
 *   feed, the sitemap or an AI index is exactly what the author asked to avoid.
 *
 * The `noIndex` check is missing-and-buggy-prone, so it lives in one place and
 * every discovery surface imports it.
 */
export function isIndexable(post: PostMeta): boolean {
  return post.published && !post.seo.noIndex;
}

/** Indexable posts, newest first — the order every feed and index wants. */
export function indexableSorted(posts: PostMeta[]): PostMeta[] {
  return posts
    .filter(isIndexable)
    .sort((a, b) => (b.updated || b.date).localeCompare(a.updated || a.date));
}

/** Unique tags across the given posts, in stable alphabetical order. */
export function collectTags(posts: PostMeta[]): string[] {
  const seen = new Set<string>();
  for (const post of posts) {
    for (const tag of post.tags) {
      if (tag.trim()) seen.add(tag);
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Minimum published posts for a tag archive to be worth indexing.
 *
 * A tag page with a single post is a heading, a count and one card. It
 * duplicates the post it points at, and on a real blog it is common for tag
 * pages to outnumber posts several times over, which turns the sitemap into
 * mostly-thin URLs and dilutes site-wide quality. Such pages stay reachable
 * (crawlers follow them via the tag links on every post) but are marked
 * `noindex, follow` and kept out of the sitemap.
 */
export const MIN_POSTS_FOR_TAG_INDEX = 2;

/**
 * Tags with enough *indexable* published posts to earn an archive page.
 *
 * Filters internally by design. The name promises indexability, so a caller
 * that passes the raw post list gets the right answer rather than having to
 * remember to pre-filter — passing an unfiltered list here would advertise tag
 * pages whose only posts are drafts or opted out, which is exactly the bug
 * class this module exists to prevent.
 */
export function indexableTags(posts: PostMeta[]): string[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (!isIndexable(post)) continue;
    for (const tag of post.tags) {
      if (tag.trim()) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= MIN_POSTS_FOR_TAG_INDEX)
    .map(([tag]) => tag)
    .sort((a, b) => a.localeCompare(b));
}
