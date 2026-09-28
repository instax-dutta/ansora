import type { PostMeta } from "../content/types";

/**
 * Cross-post overlap checks for the editor.
 *
 * Traditional on-page SEO punishes one page competing with another for the
 * same query. For a growing blog the two failure modes worth catching are:
 *
 * 1. **Cannibalization** - two posts answering the same question, so the
 *    engine has to pick one and the other is wasted effort.
 * 2. **Orphans** - a post that nothing links to, which is invisible regardless
 *    of how good it is.
 *
 * Both are computed here rather than in the component so they are testable and
 * so the same rules can be reused by a future audit endpoint.
 */

export interface OverlapWarning {
  kind: "cannibalization" | "orphan";
  severity: "high" | "medium";
  message: string;
  /** The other post this conflicts with, when applicable. */
  other?: { slug: string; title: string };
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "is",
  "are", "was", "were", "be", "by", "at", "from", "as", "it", "its", "this",
  "that", "how", "what", "why", "when", "your", "you", "my", "i", "vs", "best",
  "guide", "complete", "full", "using", "use",
]);

function terms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOP.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Titles that overlap heavily, or that share an explicit focus keyword. */
export function findCannibalization(
  current: Pick<PostMeta, "slug" | "title" | "focusKeyword" | "tags">,
  others: PostMeta[],
  threshold = 0.5
): OverlapWarning[] {
  const currentTerms = terms(current.title);
  const warnings: OverlapWarning[] = [];

  for (const other of others) {
    if (other.slug === current.slug || !other.published) continue;

    const sharedFocusKeyword =
      current.focusKeyword.trim() &&
      current.focusKeyword.trim().toLowerCase() ===
        other.focusKeyword.trim().toLowerCase();

    const overlap = jaccard(currentTerms, terms(other.title));
    const sharedTags = current.tags.filter((t) => other.tags.includes(t));

    if (sharedFocusKeyword) {
      warnings.push({
        kind: "cannibalization",
        severity: "high",
        message: `Shares the focus keyword "${current.focusKeyword}" with "${other.title}". Two pages targeting one keyword means the engine picks one.`,
        other: { slug: other.slug, title: other.title },
      });
      continue;
    }

    if (overlap >= threshold) {
      warnings.push({
        kind: "cannibalization",
        severity: "medium",
        message: `"${other.title}" looks like it answers the same question (${Math.round(overlap * 100)}% title overlap). Consider linking them or folding one into the other.`,
        other: { slug: other.slug, title: other.title },
      });
      continue;
    }

    // Same tags and nothing else to distinguish them is a softer conflict.
    if (sharedTags.length >= 2 && overlap >= 0.3) {
      warnings.push({
        kind: "cannibalization",
        severity: "medium",
        message: `Overlaps with "${other.title}" on ${sharedTags.join(", ")}. Give one of them a distinct angle.`,
        other: { slug: other.slug, title: other.title },
      });
    }
  }

  return warnings;
}

/**
 * Is this post reachable from anywhere else on the site?
 *
 * With a "Related posts" block and prev/next on every post, the only posts
 * that never get a cross-link are ones sharing no tag with anything. Related
 * selection is tag-overlap based, so a post with *no* tags can never appear in
 * any peer's related list, no matter how well tagged the rest of the blog is.
 * It still shows on the home page and the post index, so this is a nudge about
 * missed internal linking rather than an invisibility warning.
 */
export function findOrphanWarning(
  current: Pick<PostMeta, "slug" | "title" | "tags" | "published">
): OverlapWarning | null {
  if (!current.published) return null;
  if (current.tags.length > 0) return null;
  return {
    kind: "orphan",
    severity: "medium",
    message:
      "This post has no tags, so it can never appear in a related-post list. Add at least one tag to give the crawler graph an edge.",
  };
}

/**
 * How stale is this post, in months? Returns null for anything under a month,
 * which is the point: a freshness badge is only useful when it has something
 * to say.
 */
export function monthsSince(iso: string, now = Date.now()): number | null {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = (now - then) / 86_400_000;
  if (days < 30) return null;
  return Math.floor(days / 30);
}
