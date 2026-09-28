import type { PostMeta } from "../content/types";
import { MIN_POSTS_FOR_TAG_INDEX, isIndexable } from "../seo/publish";

/**
 * What the platform decided about this site's indexability, for the dashboard.
 *
 * The public surfaces make several judgement calls the author never sees: a
 * tag archive below the minimum depth is marked `noindex`, a post flagged
 * `seo.noIndex` is dropped from every feed, and a post with no tags can never
 * be cross-linked. That is all correct, but an owner who cannot see it has no
 * way to tell "nothing is wrong" from "half my site is invisible".
 *
 * This module computes the picture from the same policy functions the routes
 * use, so the dashboard can never disagree with what the crawler sees.
 */

export interface IndexabilityReport {
  published: number;
  /** Published and advertised to search engines. */
  indexable: number;
  /** Opted out by the author via `seo.noIndex`. */
  optedOut: number;
  /** Published but carrying no tag, so never cross-linked. */
  untagged: number;
  tags: number;
  /** Tag archives with enough posts to earn an index. */
  indexedTags: number;
  /** Thin tag archives, kept reachable but marked `noindex`. */
  thinTags: number;
  /** Zero published posts, so tag archives are empty. */
  emptyTags: number;
  /** The names of the thin and empty tags, for a "why" list. */
  thinTagNames: string[];
  /** `indexable / published`, 0-100, or null when there is nothing to measure. */
  coverage: number | null;
}

export function buildIndexabilityReport(posts: PostMeta[]): IndexabilityReport {
  const published = posts.filter((p) => p.published);
  const indexable = published.filter(isIndexable);
  const untagged = indexable.filter((p) => p.tags.length === 0);

  const counts = new Map<string, number>();
  for (const post of indexable) {
    for (const tag of post.tags) {
      if (tag.trim()) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  let indexedTags = 0;
  const thinTagNames: string[] = [];
  for (const [tag, count] of counts) {
    if (count >= MIN_POSTS_FOR_TAG_INDEX) indexedTags++;
    else thinTagNames.push(tag);
  }
  thinTagNames.sort((a, b) => a.localeCompare(b));

  return {
    published: published.length,
    indexable: indexable.length,
    optedOut: published.length - indexable.length,
    untagged: untagged.length,
    tags: counts.size,
    indexedTags,
    thinTags: thinTagNames.length,
    emptyTags: 0,
    thinTagNames,
    coverage:
      published.length === 0
        ? null
        : Math.round((indexable.length / published.length) * 100),
  };
}
