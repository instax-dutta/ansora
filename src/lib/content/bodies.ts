import { getAdapter, safeListPosts } from "./index";
import type { Post, PostMeta } from "./types";

/**
 * Loading post *bodies* for feeds and agent-facing endpoints.
 *
 * `listPosts()` returns frontmatter only. In the GitHub adapter it already
 * fetches every post file and throws the body away, so any surface that needs
 * bodies pays a second round of per-post requests. That is fine for one post,
 * dangerous for an unbounded archive on a rate-limited API — and worse on a
 * serverless function with a hard execution timeout, where blowing the budget
 * means a 500 on your RSS feed rather than a short response.
 *
 * So every bulk-body surface goes through here with an explicit cap **and a
 * wall-clock budget**. Callers decide the cap; this guarantees the work stops
 * rather than the request dying.
 */

/** Default wall-clock budget for a bulk body load. */
const DEFAULT_BUDGET_MS = 4_000;

export interface LoadBodiesOptions {
  /** Hard cap on how many leading posts to fetch. */
  limit: number;
  /**
   * Wall-clock budget. Loading stops early once this is exhausted; callers
   * fall back to frontmatter for whatever is missing.
   */
  budgetMs?: number;
}

export async function loadRecentBodies(
  posts: PostMeta[],
  options: number | LoadBodiesOptions
): Promise<Map<string, string>> {
  const { limit, budgetMs = DEFAULT_BUDGET_MS } =
    typeof options === "number" ? { limit: options } : options;
  const bodies = new Map<string, string>();
  if (limit <= 0 || posts.length === 0) return bodies;

  const deadline = Date.now() + budgetMs;
  try {
    const adapter = getAdapter();
    for (const meta of posts.slice(0, limit)) {
      // Stop before starting work we have no time to finish. Sequential rather
      // than parallel on purpose: a parallel burst cannot be abandoned
      // part-way, and the requests are latency-bound, not CPU-bound.
      if (Date.now() >= deadline) break;
      const post = await adapter.getPost(meta.slug);
      if (post) bodies.set(post.meta.slug, post.content);
    }
  } catch (err) {
    // Graceful: public read surfaces serve what they have rather than 500.
    console.warn("[content] post bodies unavailable for a bulk surface:", err);
  }
  return bodies;
}

/** Fetch a single published post, or null when it is missing or a draft. */
export async function loadPublishedPost(slug: string): Promise<Post | null> {
  try {
    const post = await getAdapter().getPost(slug);
    if (!post || !post.meta.published) return null;
    return post;
  } catch (err) {
    console.warn(`[content] could not load post "${slug}":`, err);
    return null;
  }
}

/** Published post bodies keyed by slug, capped — see `loadRecentBodies`. */
export async function loadPublishedBodies(
  options: LoadBodiesOptions
): Promise<{ metas: PostMeta[]; bodies: Map<string, string> }> {
  const metas = (await safeListPosts())
    .filter((p) => p.published)
    .sort((a, b) => b.date.localeCompare(a.date));
  return { metas, bodies: await loadRecentBodies(metas, options) };
}
