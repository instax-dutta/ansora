/**
 * Markdown pipeline — one shared configuration used by BOTH renderers so the
 * admin editor's live preview matches the public site exactly:
 *   - public site:  server-side unified() -> rehype-stringify (see render.ts)
 *   - editor:       react-markdown (client) with these same plugin arrays
 */
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { PluggableList } from "unified";
import { unified } from "unified";

/** Shared rehype-pretty-code options (Shiki highlighting). */
export const prettyCodeOptions = {
  // Warm dark palette — reads well in both light and dark site themes.
  theme: "everforest-dark",
  defaultLang: "text",
  keepBackground: true,
} as const;

/** Shared rehype-autolink-headings options. */
export const autolinkOptions = {
  behavior: "append",
  properties: { className: ["heading-anchor"], "aria-hidden": "true" },
  content: { type: "text", value: "#" },
} as const;

export const remarkPlugins: PluggableList = [remarkGfm];

export const rehypePlugins: PluggableList = [
  rehypeSlug,
  [rehypePrettyCode, prettyCodeOptions],
  [rehypeAutolinkHeadings, autolinkOptions],
];

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/* Structural hast shape — keeps this module free of @types/hast generics. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children?: HastNode[];
}

function nodeText(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(nodeText).join("");
}

function collectHeadings(node: HastNode, items: TocItem[]): void {
  if (node.type === "element") {
    if (node.tagName === "h2" || node.tagName === "h3") {
      items.push({
        id: String(node.properties?.id ?? ""),
        text: nodeText(node),
        level: node.tagName === "h2" ? 2 : 3,
      });
    }
  }
  for (const child of node.children ?? []) collectHeadings(child, items);
}

/**
 * Extract h2/h3 headings (with the same ids rehype-slug generates at render
 * time) so the post page can build a table of contents.
 */
export async function extractToc(markdown: string): Promise<TocItem[]> {
  const items: TocItem[] = [];
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(() => (tree: HastNode) => collectHeadings(tree, items)) as unknown as {
    parse: (input: string) => HastNode;
    run: (tree: HastNode) => Promise<HastNode>;
  };

  const tree = processor.parse(markdown);
  await processor.run(tree);
  return items;
}

export interface Heading {
  level: 1 | 2 | 3 | 4;
  text: string;
}

/**
 * Regex-based heading scan (cheap, good enough for SEO checks). Fenced code
 * blocks are stripped first so `# comments` inside code can't skew the checks.
 */
export function scanHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "");
  const re = /^(#{1,4})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(withoutCode)) !== null) {
    const level = match[1].length as 1 | 2 | 3 | 4;
    const text = match[2].trim();
    if (text) headings.push({ level, text });
  }
  return headings;
}
