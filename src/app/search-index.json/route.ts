import { safeListPosts } from "@/lib/content";
import { postUrl } from "@/lib/seo/jsonld";
import { isIndexable } from "@/lib/seo/publish";
import { getSiteConfig } from "@/lib/site-config";
import { stripMarkdown } from "@/lib/utils";

/**
 * A prebuilt search index for the client-side search box.
 *
 * The obvious objection to shipping search is a database or a hosted service.
 * Neither is needed: the corpus is already in git, so the index is generated
 * from `listPosts()` and cached like every other feed. That also means search
 * can never surface a draft, because it is built from the same
 * `isIndexable()` set as the sitemap.
 *
 * Two bounds, matching the discipline every other bulk surface in the app
 * follows:
 *
 * - `INDEX_LIMIT` keeps the payload reasonable on a large blog. The index is
 *   downloaded by the browser on first focus, so an unbounded one would cost
 *   every visitor hundreds of kilobytes to search a handful of posts.
 * - Post bodies are excluded entirely. A full-text index would mean a
 *   per-post fetch, which is exactly the cost `bodies.ts` exists to cap.
 *
 * `total` and `truncated` are reported so the client can say so rather than
 * silently presenting a partial index as the whole archive.
 */
const INDEX_LIMIT = 500;

export async function GET() {
  const [posts, config] = await Promise.all([
    safeListPosts(),
    getSiteConfig(),
  ]);

  const all = posts
    .filter(isIndexable)
    .sort((a, b) => b.date.localeCompare(a.date));

  const items = all.slice(0, INDEX_LIMIT).map((post) => ({
    slug: post.slug,
    url: postUrl(config, post.slug),
    title: post.title,
    summary: stripMarkdown(post.answer || post.excerpt).slice(0, 220),
    tags: post.tags,
    date: post.date,
  }));

  return new Response(
    JSON.stringify({
      generated: new Date().toISOString(),
      total: all.length,
      truncated: all.length > items.length,
      items,
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
