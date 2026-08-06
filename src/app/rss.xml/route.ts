import { getAdapter } from "@/lib/content";
import { getSiteConfig } from "@/lib/site-config";
import { escapeXml, stripMarkdown, toRfc2822 } from "@/lib/utils";

export async function GET() {
  const [posts, config] = await Promise.all([
    getAdapter().listPosts(),
    getSiteConfig(),
  ]);
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const published = posts
    .filter((p) => p.published)
    .sort((a, b) => b.date.localeCompare(a.date));

  const items = published
    .map((post) => {
      const link = escapeXml(`${baseUrl}/blog/${post.slug}`);
      const description = escapeXml(stripMarkdown(post.excerpt || post.title));
      const categories = post.tags
        .map((t) => `      <category>${escapeXml(t)}</category>`)
        .join("\n");
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="false">${link}</guid>
      <pubDate>${toRfc2822(post.date)}</pubDate>
      <description>${description}</description>
${categories}    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(config.title)}</title>
    <link>${baseUrl}</link>
    <description>${escapeXml(config.description)}</description>
    <language>en</language>
    <lastBuildDate>${toRfc2822(new Date().toISOString())}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
${items}  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
