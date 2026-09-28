import { loadRecentBodies } from "@/lib/content/bodies";
import { safeListPosts } from "@/lib/content";
import { aboutUrl, blogUrl, postUrl } from "@/lib/seo/jsonld";
import { isIndexable } from "@/lib/seo/publish";
import { getSiteConfig } from "@/lib/site-config";

/**
 * Capped by count *and* wall clock because each body is a per-post request in
 * serverless mode, on top of the requests `listPosts()` already made. Past
 * either bound the post is still listed with its frontmatter, answer and link,
 * so nothing silently disappears from the index.
 */
const BODY_LIMIT = 100;
const BODY_BUDGET_MS = 6_000;

/**
 * llms-full.txt — every published post as clean markdown, in one file.
 *
 * llms.txt is a catalogue (titles + one-line summaries); this is the corpus. An
 * agent that wants to quote or reason over the archive without making 200
 * separate requests reads this once. The draft/noIndex gates match every other
 * discovery surface, via the shared `isIndexable` policy.
 */
export async function GET() {
  const [posts, config] = await Promise.all([
    safeListPosts(),
    getSiteConfig(),
  ]);
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const published = posts
    .filter(isIndexable)
    .sort((a, b) => b.date.localeCompare(a.date));
  const bodies = await loadRecentBodies(published, {
    limit: BODY_LIMIT,
    budgetMs: BODY_BUDGET_MS,
  });

  const sections = published.map((post) => {
    const body = bodies.get(post.slug) ?? post.answer.trim();
    const meta: string[] = [`URL: ${postUrl(config, post.slug)}`];
    if (post.date) meta.push(`Published: ${post.date.slice(0, 10)}`);
    if (post.updated && post.updated !== post.date) {
      meta.push(`Updated: ${post.updated.slice(0, 10)}`);
    }
    if (post.tags.length) meta.push(`Tags: ${post.tags.join(", ")}`);
    if (post.answer.trim()) meta.push(`Author: ${config.author}`);

    const faq = post.faq.filter((f) => f.question && f.answer);
    const faqBlock =
      faq.length > 0
        ? `\n\n## Frequently asked questions\n\n${faq
            .map((f) => `### ${f.question}\n\n${f.answer.trim()}`)
            .join("\n\n")}`
        : "";
    const sources =
      post.sources.filter((s) => s.title.trim() || s.url.trim()).length > 0
        ? `\n\n## Sources\n\n${post.sources
            .filter((s) => s.title.trim() || s.url.trim())
            .map((s) => `- ${[s.title, s.url, s.author, s.year].filter(Boolean).join(" - ")}`)
            .join("\n")}`
        : "";

    return [
      "# " + post.title,
      "",
      "> " + post.excerpt,
      "",
      meta.join(" | "),
      "",
      "---",
      "",
      (body || post.excerpt).trim(),
      faqBlock,
      sources,
    ].join("\n");
  });

  const text = [
    `# ${config.title} - full text`,
    "",
    `> ${config.description}`,
    "",
    `> ${published.length} published post${published.length === 1 ? "" : "s"}. Index: ${baseUrl}/llms.txt`,
    "",
    "## Pages",
    "",
    `- [All posts](${blogUrl(config)})`,
    `- [About](${aboutUrl(config)})`,
    "",
    ...sections.flatMap((section, i) => [
      "---",
      "",
      section,
      ...(i < sections.length - 1 ? [""] : []),
    ]),
    "",
  ].join("\n");

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
