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
