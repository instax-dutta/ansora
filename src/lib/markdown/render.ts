/**
 * Server-side markdown -> HTML renderer (public site, SSG/ISR friendly).
 * Uses the exact same remark/rehype plugin chain as the editor's client-side
 * preview (see pipeline.ts) plus a tiny post-pass that mirrors react-markdown's
 * link/image handling (external links open in new tabs; images lazy-load).
 */
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  autolinkOptions,
  collectHeadings,
  prettyCodeOptions,
  remarkPlugins,
  rehypePlugins,
  type TocItem,
} from "./pipeline";

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Protocols we allow through to rendered href/src attributes. */
const SAFE_URL = /^(https?:|mailto:|#|\/|data:image\/)/i;

/**
 * Mirror of react-markdown's components map (a/img) in hast terms — plus URL
 * sanitization: rehype-stringify does not sanitize, so we neutralize
 * `javascript:`/`data:` links the same way the client preview does.
 */
function enrichLinksAndImages() {
  return (tree: HastNode) => {
    const walk = (node: HastNode): void => {
      if (node.type === "element") {
        const props = node.properties ?? {};
        if (node.tagName === "a") {
          const href = typeof props.href === "string" ? props.href.trim() : "";
          if (href && !SAFE_URL.test(href)) {
            // Neutralize dangerous schemes (javascript:, data:, vbscript: …).
            node.properties = { ...props, href: "#" };
          } else if (/^https?:\/\//i.test(href)) {
            node.properties = {
              ...props,
              target: "_blank",
              rel: "noopener noreferrer",
            };
          }
        } else if (node.tagName === "img") {
          const src = typeof props.src === "string" ? props.src.trim() : "";
          const safe = src && SAFE_URL.test(src);
          const className = Array.isArray(props.className)
            ? (props.className as string[])
            : [];
          node.properties = {
            ...(safe ? { src } : {}),
            loading: "lazy",
            decoding: "async",
            className: [...className, "rounded-xl"],
          };
        }
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
  };
}

// Collects h2/h3 headings during the *same* pass that renders the HTML, so a
// post page no longer parses its markdown twice (render + table of contents).
// The result rides on the vfile, which keeps the shared processor stateless
// and safe to reuse across concurrent requests.
function collectToc() {
  return (tree: HastNode, file: { data?: Record<string, unknown> }) => {
    const items: TocItem[] = [];
    collectHeadings(tree, items);
    file.data = file.data ?? {};
    file.data.toc = items;
  };
}

// Note: `rehypePlugins` already includes rehypeSlug + pretty-code + autolink;
// we list the stringify step (and the link/image post-pass) here.
const processor = unified()
  .use(remarkParse)
  .use(remarkPlugins)
  .use(remarkRehype)
  .use(rehypePlugins)
  .use(collectToc)
  .use(enrichLinksAndImages)
  .use(rehypeStringify);

export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await processor.process(markdown);
  return String(file);
}

/** Render a post once, returning both its HTML and its table of contents. */
export async function renderMarkdownWithToc(
  markdown: string
): Promise<{ html: string; toc: TocItem[] }> {
  const file = await processor.process(markdown);
  return {
    html: String(file),
    toc: ((file.data as Record<string, unknown>).toc as TocItem[] | undefined) ?? [],
  };
}

/** Shared options re-exported for the client preview's react-markdown setup. */
export { autolinkOptions, prettyCodeOptions, remarkPlugins, rehypePlugins };
