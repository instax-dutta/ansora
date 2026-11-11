import { revalidatePath } from "next/cache";

/**
 * Invalidate every public surface after a content or settings change.
 *
 * This is what lets the public site be statically rendered and still feel
 * live: a save clears the cached entries that changed, and the next visit
 * renders fresh HTML. It replaces the old "rebuild everything every 5
 * minutes" cadence with "rebuild the touched paths, once, when something
 * actually changes".
 *
 * Best-effort on purpose: a failed invalidation must never fail the save. The
 * one-hour `revalidate` on each route is the fallback.
 */
export function revalidatePublicSurfaces(slug?: string): void {
  for (const path of ["/", "/blog", "/tags", "/topics", "/about"]) {
    safeRevalidate(path);
  }
  // Sweep the dynamic routes as well. The literal paths below are the ones
  // that matter for a publish: a path that was requested before the post
  // existed has a cached 404, and the pattern form does not clear it.
  safeRevalidate("/blog/[slug]", "page");
  safeRevalidate("/tags/[tag]", "page");
  safeRevalidate("/md/[...slug]", "page");
  if (slug) {
    safeRevalidate(`/blog/${slug}`);
    safeRevalidate(`/md/blog/${slug}`);
  }

  for (const path of [
    "/rss.xml",
    "/feed.json",
    "/llms.txt",
    "/llms-full.txt",
    "/search-index.json",
    "/md",
    "/sitemap.xml",
    "/robots.txt",
  ]) {
    safeRevalidate(path);
  }
}

function safeRevalidate(path: string, type?: "page" | "layout"): void {
  try {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  } catch (err) {
    console.warn(`[revalidate] could not revalidate ${path}:`, err);
  }
}
