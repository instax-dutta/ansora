import { loadRecentBodies } from "@/lib/content/bodies";
import { safeListPosts } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown/render";
import { isIndexable } from "@/lib/seo/publish";
import { getSiteConfig } from "@/lib/site-config";
import { escapeXml, toRfc2822 } from "@/lib/utils";

/**
 * How many recent items carry a fully rendered article body.
 *
 * Two costs stack here: fetching each body is a per-post request in serverless
 * mode, and rendering runs the shared pipeline including Shiki (a one-time
 * ~1.3 s grammar load, then ~7 ms per post). Both are bounded by a count cap
 * and a wall-clock budget so a long-running blog on a serverless function gets
 * a short feed instead of a 500. Items without a body still appear, using the
 * excerpt — nothing is ever dropped from the feed.
 */
const FULL_CONTENT_ITEMS = 10;
const RENDER_BUDGET_MS = 4_000;

/**
 * Escape for a CDATA section. A literal `]]>` inside post content would close
 * the section early and let the remainder be parsed as feed markup.
 */
function cdata(value: string): string {
  return value.replace(/]]>/g, "]]]]><![CDATA[>");
}

export async function GET() {
  // Degrade to an empty feed if the content adapter is unreachable (e.g. a
  // serverless build without GITHUB_REPO/GITHUB_TOKEN) — an empty RSS feed
  // beats failing the build or serving a 500.
  const [posts, config] = await Promise.all([
    safeListPosts(),
    getSiteConfig(),
  ]);
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  // `isIndexable` (not just `published`): a post marked seo.noIndex must not be
  // syndicated to subscribers, or the opt-out is meaningless.
  const published = posts
    .filter(isIndexable)
    .sort((a, b) => b.date.localeCompare(a.date));

  const bodies = new Map<string, string>();
  const recent = await loadRecentBodies(published, {
    limit: FULL_CONTENT_ITEMS,
    budgetMs: RENDER_BUDGET_MS,
  });
  // Render sequentially against a deadline: a bulk render that overstays a
  // serverless timeout turns a working feed into an error response.
  const deadline = Date.now() + RENDER_BUDGET_MS;
  for (const [slug, body] of recent) {
    if (Date.now() >= deadline) break;
    bodies.set(slug, await renderMarkdown(body));
  }

  const items = published
    .map((post) => {
      const link = escapeXml(`${baseUrl}/blog/${post.slug}`);
      const categories = post.tags
        .map((t) => `      <category>${escapeXml(t)}</category>`)
        .join("\n");
      const body = bodies.get(post.slug);
      const content =
        body !== undefined
          ? `\n      <content:encoded><![CDATA[${cdata(body)}]]></content:encoded>`
          : "";
      const updated =
        post.updated && post.updated !== post.date
          ? `\n      <atom:updated>${toRfc2822(post.updated)}</atom:updated>`
          : "";
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${toRfc2822(post.date)}</pubDate>
      <dc:creator>${escapeXml(config.author)}</dc:creator>${updated}${content}
${categories}
      <description>${escapeXml(post.excerpt || post.title)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(config.title)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(config.description)}</description>
    <language>en</language>
    <managingEditor>${escapeXml(config.author)}</managingEditor>
    <webMaster>${escapeXml(config.author)}</webMaster>
    <lastBuildDate>${toRfc2822(new Date().toISOString())}</lastBuildDate>
    <generator>Ansora</generator>
    <atom:link href="${escapeXml(`${baseUrl}/rss.xml`)}" rel="self" type="application/rss+xml" />
    <atom:link href="${escapeXml(`${baseUrl}/feed.json`)}" rel="alternate" type="application/feed+json" />${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
