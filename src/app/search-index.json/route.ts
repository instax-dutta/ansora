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
 * from `listPosts()` at request time and cached like every other feed. That
 * also means search can never surface a draft, because it is built from the
 * same `isIndexable()` set as the sitemap and the feeds.
 *
 * Only the fields needed to render a result are included. Post bodies are
 * deliberately excluded — a full-text index would mean a per-post fetch, which
 * is the exact cost `bodies.ts` exists to cap.
 */
export async function GET() {
  const [posts, config] = await Promise.all([
    safeListPosts(),
    getSiteConfig(),
  ]);

  const items = posts
    .filter(isIndexable)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((post) => ({
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
      count: items.length,
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
