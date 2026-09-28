import type { PostMeta, SiteConfig } from "@/lib/content/types";
import { postUrl } from "./jsonld";

/**
 * Markdown rendering of public pages, for content negotiation.
 *
 * The point: an agent asking for `text/markdown` currently has to scrape our
 * HTML, strip navigation and inline styles, and guess where the body starts.
 * Serving the markdown source directly is lossless, ~10x smaller, and removes
 * the main reason agents give up on a site.
 *
 * Every document carries YAML frontmatter plus a plain `Source:` line, so both
 * a YAML parser and a language model get the metadata.
 */

const MARKDOWN_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  // The HTML route is the canonical representation; this mirror must never
  // compete with it in the index.
  "X-Robots-Tag": "noindex, follow",
} as const;

/** Double-quoted YAML scalar — safe for any string content. */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function frontmatter(fields: [string, string | undefined][]): string {
  const lines = fields
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${yamlString(v as string)}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

export const MARKDOWN_RESPONSE_HEADERS = MARKDOWN_HEADERS;

function byNewest(a: PostMeta, b: PostMeta): number {
  return (b.updated || b.date).localeCompare(a.updated || a.date);
}

export function buildPostMarkdown(
  meta: PostMeta,
  content: string,
  config: SiteConfig
): string {
  const faqBlock = meta.faq
    .filter((f) => f.question && f.answer)
    .map((f) => `## ${f.question}\n\n${f.answer.trim()}`)
    .join("\n\n");

  const sources = meta.sources.filter((s) => s.title.trim() || s.url.trim());
  const sourcesBlock =
    sources.length > 0
      ? `## Sources\n\n${sources
          .map((s) => `- ${[s.title, s.url, s.author, s.year].filter(Boolean).join(" - ")}`)
          .join("\n")}`
      : "";

  const body = [
    meta.answer.trim() || content.trim(),
    faqBlock,
    sourcesBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    frontmatter([
      ["title", meta.title],
      ["description", meta.seo.metaDescription || meta.excerpt],
      ["url", postUrl(config, meta.slug)],
      ["author", config.author],
      ["date", meta.date],
      ["updated", meta.updated !== meta.date ? meta.updated : undefined],
      ["tags", meta.tags.length ? meta.tags.join(", ") : undefined],
    ]),
    `\n# ${meta.title}\n`,
    meta.excerpt ? `\n${meta.excerpt}\n` : "",
    `\nSource: ${postUrl(config, meta.slug)}\n`,
    `\n${body}\n`,
  ].join("");
}

export function buildListingMarkdown(
  title: string,
  description: string,
  posts: PostMeta[],
  config: SiteConfig,
  canonical: string
): string {
  const items = [...posts]
    .sort(byNewest)
    .map((post) => {
      const summary = (post.answer || post.excerpt).trim();
      return `- [${post.title}](${postUrl(config, post.slug)})${
        post.date ? ` - ${post.date.slice(0, 10)}` : ""
      }${summary ? `: ${summary}` : ""}`;
    });

  return [
    frontmatter([
      ["title", title],
      ["description", description],
      ["url", canonical],
    ]),
    `\n# ${title}\n`,
    description ? `\n${description}\n` : "",
    `\nSource: ${canonical}\n`,
    items.length
      ? `\n${items.join("\n")}\n`
      : "\n_No published posts yet._\n",
  ].join("");
}

export function buildTagsIndexMarkdown(
  entries: { tag: string; count: number }[],
  config: SiteConfig
): string {
  const items = entries.map(
    ({ tag, count }) => `- ${tag} (${count} ${count === 1 ? "post" : "posts"})`
  );
  return [
    frontmatter([
      ["title", `Tags on ${config.title}`],
      ["url", `${config.baseUrl.replace(/\/+$/, "")}/tags`],
    ]),
    `\n# Tags on ${config.title}\n`,
    "\nEvery topic covered, with post counts.\n",
    items.length ? `\n${items.join("\n")}\n` : "\n_No tags yet._\n",
  ].join("");
}

export function buildTagMarkdown(
  tag: string,
  posts: PostMeta[],
  config: SiteConfig
): string {
  const canonical = `${config.baseUrl.replace(/\/+$/, "")}/tags/${tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
  return buildListingMarkdown(
    `Posts tagged "${tag}"`,
    `All published posts on ${config.title} tagged "${tag}".`,
    posts,
    config,
    canonical
  );
}

export function buildAboutMarkdown(config: SiteConfig): string {
  const links = [
    ["GitHub", config.social.github],
    ["Twitter", config.social.twitter],
    ["LinkedIn", config.social.linkedin],
  ].filter(([, href]) => href);

  return [
    frontmatter([
      ["title", `About ${config.author}`],
      ["description", config.authorBio || `${config.author}, author at ${config.title}.`],
      ["url", `${config.baseUrl.replace(/\/+$/, "")}/about`],
    ]),
    `\n# ${config.author}\n`,
    config.authorRole ? `\n${config.authorRole}\n` : "",
    config.authorBio
      ? `\n${config.authorBio}\n`
      : `\n${config.author} writes at ${config.title}. ${config.description}\n`,
    links.length
      ? `\n## Elsewhere\n\n${links
          .map(([label, href]) => `- [${label}](${href})`)
          .join("\n")}\n`
      : "",
  ].join("");
}
