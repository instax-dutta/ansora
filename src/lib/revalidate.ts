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
export function revalidatePublicSurfaces(): void {
  for (const path of ["/", "/blog", "/tags", "/topics", "/about"]) {
    safeRevalidate(path);
  }
  // Dynamic segments need the route pattern plus an explicit type.
  safeRevalidate("/blog/[slug]", "page");
  safeRevalidate("/tags/[tag]", "page");

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
