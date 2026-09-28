import type { PostMeta, SiteConfig } from "@/lib/content/types";
import { tagSlug } from "@/lib/utils";

/**
 * Structured data for AI search (GEO/AEO).
 *
 * The guiding idea: AI engines do not just read pages, they build an **entity
 * graph**. A post that names an author nobody can resolve is weaker evidence
 * than a post that links to a described `Person` node with `sameAs` profiles.
 * So every page here emits a self-contained `@graph` carrying both the page
 * entity and the site entities it references, and cross-links them by `@id`.
 *
 * Two practical consequences of the `@id` scheme:
 * - Every page is independently resolvable. Nothing depends on another page's
 *   JSON-LD being crawled first.
 * - Adding the ~4 small entity nodes to every page is cheaper than the crawl
 *   ambiguity it removes.
 */

/** The site is single-locale; `lang="en"` in the root layout is the source of truth. */
export const SITE_LANGUAGE = "en";

function base(config: SiteConfig): string {
  return config.baseUrl.replace(/\/+$/, "");
}

export function postUrl(config: SiteConfig, slug: string): string {
  return `${base(config)}/blog/${slug}`;
}

export function tagUrl(config: SiteConfig, tag: string): string {
  return `${base(config)}/tags/${tagSlug(tag)}`;
}

export function aboutUrl(config: SiteConfig): string {
  return `${base(config)}/about`;
}

/**
 * The site root, deliberately **without** a trailing slash.
 *
 * The sitemap shipped by earlier versions submitted the bare origin
 * (`https://example.com`). Adding a slash would submit a second spelling of an
 * already-indexed URL, so the original form is preserved and every canonical
 * agrees with it.
 */
export function homeUrl(config: SiteConfig): string {
  return base(config);
}

export function blogUrl(config: SiteConfig): string {
  return `${base(config)}/blog`;
}

export function tagsUrl(config: SiteConfig): string {
  return `${base(config)}/tags`;
}

export function topicsUrl(config: SiteConfig): string {
  return `${base(config)}/topics`;
}

/* ------------------------------ Entity ids ------------------------------- */

export const siteId = (config: SiteConfig) => `${base(config)}/#website`;
export const organizationId = (config: SiteConfig) => `${base(config)}/#organization`;
export const authorId = (config: SiteConfig) => `${base(config)}/#author`;
export const blogId = (config: SiteConfig) => `${base(config)}/#blog`;
export const tagEntityId = (config: SiteConfig, tag: string) =>
  `${tagUrl(config, tag)}#tag`;

/** Only absolute http(s) values are valid `sameAs` entries. */
function sameAsProfiles(config: SiteConfig): string[] {
  return [
    config.social.twitter,
    config.social.github,
    config.social.linkedin,
  ].filter((url): url is string => Boolean(url) && /^https?:\/\//i.test(url));
}

/**
 * The four site-level entities, in dependency order. Spread into every page
 * graph so each page can resolve its own `publisher` / `author` / `isPartOf`
 * references without a cross-page lookup.
 */
export function siteEntityNodes(config: SiteConfig): Record<string, unknown>[] {
  const links = sameAsProfiles(config);
  const withSameAs = (node: Record<string, unknown>): Record<string, unknown> =>
    links.length ? { ...node, sameAs: links } : node;

  return [
    withSameAs({
      "@type": "Organization",
      "@id": organizationId(config),
      name: config.title,
      url: homeUrl(config),
      description: config.description,
    }),
    {
      "@type": "Person",
      "@id": authorId(config),
      name: config.author,
      url: aboutUrl(config),
      ...(config.authorRole ? { jobTitle: config.authorRole } : {}),
      ...(config.authorBio ? { description: config.authorBio } : {}),
      worksFor: { "@id": organizationId(config) },
    },
    {
      "@type": "Blog",
      "@id": blogId(config),
      url: homeUrl(config),
      name: config.title,
      description: config.description,
      inLanguage: SITE_LANGUAGE,
      blogPublisher: { "@id": organizationId(config) },
    },
    {
      "@type": "WebSite",
      "@id": siteId(config),
      url: homeUrl(config),
      name: config.title,
      description: config.description,
      inLanguage: SITE_LANGUAGE,
      publisher: { "@id": organizationId(config) },
    },
  ];
}

/* ------------------------------ Page graphs ------------------------------ */

export interface PostGraphOptions {
  wordCount: number;
  /** Cover image alt text, used as the schema caption. */
  imageAlt?: string;
}

function faqNode(meta: PostMeta): Record<string, unknown> | null {
  const items = meta.faq.filter((f) => f.question && f.answer);
  if (items.length === 0) return null;
  return {
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/**
 * JSON-LD for a post page: the site entities plus `BlogPosting`, a
 * `BreadcrumbList` (which must mirror the visible breadcrumb) and, when the
 * post has one, a `FAQPage`.
 */
export function buildPostGraph(
  meta: PostMeta,
  config: SiteConfig,
  options: PostGraphOptions
): Record<string, unknown> {
  const url = postUrl(config, meta.slug);
  const image = meta.coverImage || config.defaultOgImage;
  const description = meta.seo.metaDescription || meta.excerpt;
  const headline = meta.seo.metaTitle || meta.title;

  const blogPosting: Record<string, unknown> = {
    "@type": "BlogPosting",
    "@id": `${url}#post`,
    isPartOf: { "@id": blogId(config) },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    headline,
    description,
    datePublished: meta.date,
    dateModified: meta.updated || meta.date,
    author: { "@id": authorId(config) },
    publisher: { "@id": organizationId(config) },
    inLanguage: SITE_LANGUAGE,
    wordCount: options.wordCount,
    isAccessibleForFree: true,
  };

  if (image) {
    blogPosting.image = {
      "@type": "ImageObject",
      url: image,
      ...(options.imageAlt || meta.coverImageAlt
        ? { caption: options.imageAlt || meta.coverImageAlt }
        : {}),
    };
  }
  if (meta.tags.length) {
    blogPosting.keywords = meta.tags.join(", ");
    blogPosting.about = meta.tags.map((tag) => ({
      "@type": "Thing",
      name: tag,
      url: tagUrl(config, tag),
    }));
  }

  // `speakable` marks the passage a voice assistant or answer engine should
  // read aloud. Pointing it at rendered elements (not inline text) is what
  // makes it survive a layout change.
  const speakableSelectors: string[] = [];
  if (meta.answer.trim()) speakableSelectors.push(".post-answer");
  if (meta.faq.some((f) => f.question && f.answer)) speakableSelectors.push(".post-faq");
  if (speakableSelectors.length) {
    blogPosting.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: speakableSelectors,
    };
  }

  const graph: Record<string, unknown>[] = [
    ...siteEntityNodes(config),
    blogPosting,
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: config.title, item: homeUrl(config) },
        { "@type": "ListItem", position: 2, name: "Blog", item: blogUrl(config) },
        { "@type": "ListItem", position: 3, name: meta.title, item: url },
      ],
    },
  ];

  const faq = faqNode(meta);
  if (faq) graph.push({ ...faq, "@id": `${url}#faq` });

  return { "@context": "https://schema.org", "@graph": graph };
}

/** JSON-LD for the post index / home listing. */
export function buildListingGraph(
  config: SiteConfig,
  posts: PostMeta[],
  page: { name: string; url: string; description: string }
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      ...siteEntityNodes(config),
      {
        "@type": "CollectionPage",
        "@id": `${page.url}#page`,
        url: page.url,
        name: page.name,
        description: page.description,
        inLanguage: SITE_LANGUAGE,
        isPartOf: { "@id": siteId(config) },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: posts.length,
          itemListElement: posts.map((post, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: post.title,
            url: postUrl(config, post.slug),
          })),
        },
      },
    ],
  };
}

/** JSON-LD for a tag archive: a described `CollectionPage` over an `ItemList`. */
export function buildTagGraph(
  config: SiteConfig,
  tag: string,
  posts: PostMeta[]
): Record<string, unknown> {
  const url = tagUrl(config, tag);
  return {
    "@context": "https://schema.org",
    "@graph": [
      ...siteEntityNodes(config),
      {
        "@type": "Thing",
        "@id": tagEntityId(config, tag),
        name: tag,
        url,
      },
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: `Posts tagged "${tag}"`,
        description: `All published posts on ${config.title} tagged "${tag}".`,
        inLanguage: SITE_LANGUAGE,
        isPartOf: { "@id": blogId(config) },
        about: { "@id": tagEntityId(config, tag) },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: posts.length,
          itemListElement: posts.map((post, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: post.title,
            url: postUrl(config, post.slug),
          })),
        },
      },
    ],
  };
}

/** JSON-LD for the tags index: a CollectionPage over the topic entities. */
export function buildTagsIndexGraph(
  config: SiteConfig,
  tags: { tag: string; count: number }[]
): Record<string, unknown> {
  const url = tagsUrl(config);
  return {
    "@context": "https://schema.org",
    "@graph": [
      ...siteEntityNodes(config),
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: `Tags on ${config.title}`,
        description: `Every topic covered on ${config.title}.`,
        inLanguage: SITE_LANGUAGE,
        isPartOf: { "@id": siteId(config) },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: tags.length,
          itemListElement: tags.map(({ tag, count }, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: tag,
            url: tagUrl(config, tag),
            ...(count > 0 ? { itemCount: count } : {}),
          })),
        },
      },
    ],
  };
}

/**
 * JSON-LD for /about. The `Person` node here is the canonical, fully described
 * version of the author entity that every post references by `@id`.
 */
export function buildAboutGraph(config: SiteConfig): Record<string, unknown> {
  const url = aboutUrl(config);
  const links = sameAsProfiles(config);
  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": authorId(config),
    name: config.author,
    url,
    ...(config.authorRole ? { jobTitle: config.authorRole } : {}),
    ...(config.authorBio ? { description: config.authorBio } : {}),
    worksFor: { "@id": organizationId(config) },
  };
  if (links.length) person.sameAs = links;

  return {
    "@context": "https://schema.org",
    "@graph": [
      ...siteEntityNodes(config),
      person,
      {
        "@type": "ProfilePage",
        "@id": `${url}#page`,
        url,
        name: `About ${config.author}`,
        description:
          config.authorBio || `${config.author}, author at ${config.title}.`,
        inLanguage: SITE_LANGUAGE,
        isPartOf: { "@id": siteId(config) },
        mainEntity: { "@id": authorId(config) },
      },
    ],
  };
}

/** Strip XML syntax from a value for embedding inside `content:encoded`. */
export function stripForFeed(html: string): string {
  return html.replace(/<\/?(?:html|body|article|main)[^>]*>/gi, "");
}

/**
 * JSON.stringify hardened for embedding inside a `<script type="application/ld+json">`
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
