import { safeListPosts } from "@/lib/content";
import { aboutUrl, blogUrl, homeUrl, postUrl, tagsUrl } from "@/lib/seo/jsonld";
import { collectTags, isIndexable } from "@/lib/seo/publish";
import { getSiteConfig } from "@/lib/site-config";
import { stripMarkdown } from "@/lib/utils";

/**
 * llms.txt — a plain-text content index following the llmstxt.org convention,
 * giving AI crawlers and answer engines a clean, structured map of the blog.
 *
 * The upgrade over a flat post list is the `## Topics` section: an agent
 * deciding *whether* to read a post first wants the topic map, and a topic map
 * is also what a topical-authority signal looks like in machine-readable form.
 */
export async function GET() {
  // Degrade to a title-only index if the content adapter is unreachable (e.g.
  // a serverless build without GITHUB_REPO/GITHUB_TOKEN) — never fail a build.
  const [posts, config] = await Promise.all([
    safeListPosts(),
    getSiteConfig(),
  ]);
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  // `isIndexable` (not just `published`): a post marked seo.noIndex must not
  // be listed to AI crawlers, or the opt-out is meaningless.
  const published = posts
    .filter(isIndexable)
    .sort((a, b) => (b.updated || b.date).localeCompare(a.updated || a.date));

  const tags = collectTags(published);
  const byTag = new Map<string, typeof published>();
  for (const tag of tags) {
    byTag.set(
      tag,
      published.filter((p) => p.tags.includes(tag))
    );
  }

  const describe = (summary: string) => stripMarkdown(summary).replace(/\s+/g, " ").trim();

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
      // Prefer the author's direct answer over the excerpt: it is the passage
      // an answer engine is most likely to quote.
      const summary = describe(post.answer || post.excerpt || post.title);
      const updated =
        post.updated && post.updated !== post.date
          ? ` (updated ${post.updated.slice(0, 10)})`
          : "";
      return `- [${post.title}](${postUrl(config, post.slug)}): ${summary}${updated}`;
    }),
    "",
    "## Topics",
    "",
    ...tags.flatMap((tag) => [
      `### ${tag}`,
      "",
      ...(byTag.get(tag) ?? []).map(
        (post) => `- [${post.title}](${postUrl(config, post.slug)})`
      ),
      "",
    ]),
    "## Pages",
    "",
    `- [All posts](${blogUrl(config)})`,
    `- [Tags](${tagsUrl(config)})`,
    `- [About ${config.author}](${aboutUrl(config)})`,
    `- [Home](${homeUrl(config)})`,
    "",
    "## Feeds",
    "",
    `- [RSS](${baseUrl}/rss.xml)`,
    `- [JSON Feed](${baseUrl}/feed.json)`,
    `- [Sitemap](${baseUrl}/sitemap.xml)`,
    `- [Full text for agents](${baseUrl}/llms-full.txt)`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
