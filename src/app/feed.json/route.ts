import { loadRecentBodies } from "@/lib/content/bodies";
import { safeListPosts } from "@/lib/content";
import { homeUrl, postUrl } from "@/lib/seo/jsonld";
import { isIndexable } from "@/lib/seo/publish";
import { getSiteConfig } from "@/lib/site-config";
import { stripMarkdown } from "@/lib/utils";

/**
 * JSON Feed 1.1 (https://jsonfeed.org/version/1.1).
 *
 * Complements RSS rather than replacing it. Items carry `content_text` — the
 * raw markdown, not rendered HTML — so there is no Shiki render pass and the
 * payload stays lossless. Bodies are capped because fetching them is a
 * per-post request in serverless mode; every item still gets a `summary`.
 */
const CONTENT_ITEMS = 20;
const CONTENT_BUDGET_MS = 4_000;
export async function GET() {
  const [posts, config] = await Promise.all([
    safeListPosts(),
    getSiteConfig(),
  ]);
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const published = posts
    .filter(isIndexable)
    .sort((a, b) => (b.updated || b.date).localeCompare(a.updated || a.date));

  const bodies = await loadRecentBodies(published, {
    limit: CONTENT_ITEMS,
    budgetMs: CONTENT_BUDGET_MS,
  });

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: config.title,
    home_page_url: homeUrl(config),
    feed_url: `${baseUrl}/feed.json`,
    description: config.description,
    language: "en",
    authors: [{ name: config.author, url: `${baseUrl}/about` }],
    items: published.map((post) => ({
      id: postUrl(config, post.slug),
      url: postUrl(config, post.slug),
      title: post.title,
      summary: stripMarkdown(post.excerpt || post.title),
      ...(bodies.has(post.slug)
        ? {
            content_text: [post.answer.trim(), bodies.get(post.slug)?.trim()]
              .filter(Boolean)
              .join("\n\n"),
          }
        : {}),
      date_published: post.date,
      date_modified: post.updated || post.date,
      ...(post.tags.length ? { tags: post.tags } : {}),
      ...(post.coverImage ? { image: post.coverImage } : {}),
    })),
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
