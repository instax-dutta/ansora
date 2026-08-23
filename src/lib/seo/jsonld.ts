import type { PostMeta, SiteConfig } from "@/lib/content/types";

export function postUrl(config: SiteConfig, slug: string): string {
  return `${config.baseUrl.replace(/\/+$/, "")}/blog/${slug}`;
}

/** JSON-LD for a single post: BlogPosting (+ FAQPage when faq present). */
export function buildPostJsonLd(
  meta: PostMeta,
  config: SiteConfig
): Record<string, unknown>[] {
  const url = postUrl(config, meta.slug);
  const image = meta.coverImage || config.defaultOgImage || undefined;

  const blogPosting: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.seo.metaTitle || meta.title,
    description: meta.seo.metaDescription || meta.excerpt,
    datePublished: meta.date,
    dateModified: meta.updated || meta.date,
    author: { "@type": "Person", name: config.author },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(image ? { image: { "@type": "ImageObject", url: image } } : {}),
    ...(meta.tags.length
      ? { keywords: meta.tags.join(", ") }
      : {}),
  };

  const graphs: Record<string, unknown>[] = [blogPosting];

  if (meta.faq.length > 0) {
    graphs.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: meta.faq
        .filter((f) => f.question && f.answer)
        .map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
    });
  }

  return graphs;
}

/**
 * JSON.stringify hardened for embedding inside a <script type="application/ld+json">
 * tag: raw stringify leaves `<`, `>`, `&` and the U+2028/U+2029 line
 * separators intact, so a post field containing `</script>` could break out
 * of the structured-data block and inject markup. Escaping them keeps the
 * JSON semantically identical while making breakout impossible.
 */
export function serializeJsonLd(graph: Record<string, unknown>): string {
  return JSON.stringify(graph)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
