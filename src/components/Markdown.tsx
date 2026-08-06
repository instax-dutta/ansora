"use client";

/**
 * Client-side markdown renderer for the admin editor's live preview.
 * Uses the exact same remark/rehype plugin arrays as the server-side renderer
 * (src/lib/markdown/render.ts), so the preview matches the shipped output.
 */
import ReactMarkdown, { type Components } from "react-markdown";
import { rehypePlugins, remarkPlugins } from "@/lib/markdown/pipeline";

const components: Components = {
  a: ({ node, href, children, ...props }) => {
    void node; // react-markdown passes the hast node — not a DOM attribute
    const external = typeof href === "string" && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        {...props}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {children}
      </a>
    );
  },
  img: ({ node, src, alt, ...props }) => {
    void node; // same as above — strip the hast node before spreading
    return (
      // Alt is required by the SEO scorer; render it empty if missing rather
      // than letting the browser announce a broken image.
      // eslint-disable-next-line @next/next/no-img-element -- content images are arbitrary external URLs; next/image optimization doesn't apply
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className="rounded-xl"
        {...props}
      />
    );
  },
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
}
