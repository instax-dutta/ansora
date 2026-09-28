import type { PostMeta, SiteConfig } from "@/lib/content/types";
import { postUrl } from "./jsonld";

/**
 * Search-result and social-card previews, computed from the exact values that
 * will ship.
 *
 * The point is honesty: the editor should show what Google and a social
 * platform will actually render, including how a long title gets truncated.
 * Guessing at that is how writers end up with titles that silently lose their
 * keyword in the SERP.
 */

export interface SerpPreview {
  url: string;
  /** Full title as it will be submitted, before truncation. */
  title: string;
  /** Title as it appears in results, ellipsised past `TITLE_LIMIT`. */
  displayTitle: string;
  titleTruncated: boolean;
  description: string;
  descriptionTruncated: boolean;
  siteName: string;
}

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

export function truncate(value: string, limit: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  // Prefer a word boundary so the keyword is not cut in half.
  const clipped = clean.slice(0, limit);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/** The values a post will actually publish with, after fallbacks. */
export function resolveSerp(
  meta: Pick<PostMeta, "title" | "slug" | "excerpt" | "seo">,
  config: SiteConfig
): SerpPreview {
  const rawTitle = meta.seo.metaTitle || meta.title;
  const rawDescription = meta.seo.metaDescription || meta.excerpt;
  const displayTitle = truncate(rawTitle, TITLE_LIMIT);
  return {
    url: meta.seo.canonicalUrl || postUrl(config, meta.slug),
    title: rawTitle,
    displayTitle,
    titleTruncated: displayTitle.length < rawTitle.replace(/\s+/g, " ").trim().length,
    description: rawDescription,
    descriptionTruncated: rawDescription.length > DESCRIPTION_LIMIT,
    siteName: config.title,
  };
}

export interface SocialPreview {
  title: string;
  description: string;
  image: string;
  card: "summary_large_image" | "summary";
  /** True when the post has no image, so the card falls back to a small card. */
  missingImage: boolean;
}

export function resolveSocial(
  meta: Pick<PostMeta, "title" | "seo" | "coverImage" | "excerpt">,
  config: SiteConfig
): SocialPreview {
  const image = meta.coverImage || config.defaultOgImage;
  return {
    title: meta.seo.metaTitle || meta.title,
    description: meta.seo.metaDescription || meta.excerpt,
    image,
    card: image ? "summary_large_image" : "summary",
    missingImage: !image,
  };
}
