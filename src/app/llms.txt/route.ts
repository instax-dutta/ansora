import { safeListPosts } from "@/lib/content";
import { getSiteConfig } from "@/lib/site-config";
import { stripMarkdown } from "@/lib/utils";

/**
 * llms.txt — a plain-text content index following the llmstxt.org convention,
 * giving AI crawlers and answer engines a clean, structured map of the blog.
 */
export async function GET() {
  // Degrade to a title-only index if the content adapter is unreachable (e.g.
  // a serverless build without GITHUB_REPO/GITHUB_TOKEN) — never fail a build.
  const [posts, config] = await Promise.all([
    safeListPosts(),
    getSiteConfig(),
  ]);
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const published = posts
    .filter((p) => p.published)
    .sort((a, b) => b.date.localeCompare(a.date));

  const lines = [
    `# ${config.title}`,
    "",
    `> ${config.description}`,
    "",
    `> ${baseUrl}`,
    "",
    "## Posts",
    "",
    ...published.map((post) => {
      const summary = stripMarkdown(post.excerpt || post.title);
      return `- [${post.title}](${baseUrl}/blog/${post.slug}): ${summary}`;
    }),
    "",
    "## About",
    "",
    `- [Home](${baseUrl}/)`,
    `- [RSS feed](${baseUrl}/rss.xml)`,
    `- [Sitemap](${baseUrl}/sitemap.xml)`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
