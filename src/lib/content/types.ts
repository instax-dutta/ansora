/**
 * Content model + frontmatter validation.
 *
 * Every post is a markdown file with YAML frontmatter, validated by zod.
 * Reads are lenient (defaults applied), writes are normalized to this shape.
 */
import { z } from "zod";

/* ------------------------------- Frontmatter ------------------------------ */

export const seoSchema = z.object({
  metaTitle: z.string().default(""),
  metaDescription: z.string().default(""),
  canonicalUrl: z.string().default(""),
  noIndex: z.boolean().default(false),
});
export type Seo = z.infer<typeof seoSchema>;

export const faqItemSchema = z.object({
  question: z.string().default(""),
  answer: z.string().default(""),
});
export type FaqItem = z.infer<typeof faqItemSchema>;

export const postMetaSchema = z.object({
  title: z.string().default(""),
  slug: z.string().default(""),
  /** ISO date string (YYYY-MM-DD or full timestamp). */
  date: z.string().default(() => new Date().toISOString()),
  /** ISO date string, set when a post is edited after publication. */
  updated: z.string().optional(),
  excerpt: z.string().default(""),
  coverImage: z.string().default(""),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(false),
  /** Optional focus keyword used by the on-page SEO scorer. */
  focusKeyword: z.string().default(""),
  seo: seoSchema.default({
    metaTitle: "",
    metaDescription: "",
    canonicalUrl: "",
    noIndex: false,
  }),
  faq: z.array(faqItemSchema).default([]),
});
export type PostMeta = z.infer<typeof postMetaSchema>;

/** A post: validated frontmatter + raw markdown body. */
export interface Post {
  meta: PostMeta;
  /** Markdown body (no frontmatter). */
  content: string;
  /** File name on disk / in the repo (without the posts dir). */
  fileName: string;
}

/**
 * Recursively remove `undefined` values — js-yaml refuses to dump them, and
 * optional frontmatter fields (e.g. `updated`) are `undefined` when absent.
 */
function cleanUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanUndefined);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) out[key] = cleanUndefined(item);
    }
    return out;
  }
  return value;
}

/** Normalize raw YAML frontmatter (gray-matter may hand us Dates) and validate. */
export function normalizeFrontmatter(raw: Record<string, unknown>): PostMeta {
  const data: Record<string, unknown> = { ...raw };
  for (const key of ["date", "updated"] as const) {
    const value = data[key];
    if (value instanceof Date) data[key] = value.toISOString();
    else if (typeof value === "number" || typeof value === "string") {
      // Keep strings/numbers as-is; zod will coerce where sensible.
      data[key] = value;
    }
  }
  return cleanUndefined(postMetaSchema.parse(data)) as PostMeta;
}

/** Canonical order + shape used when serializing frontmatter back to YAML. */
export function serializeFrontmatter(meta: PostMeta): Record<string, unknown> {
  return {
    title: meta.title,
    slug: meta.slug,
    date: meta.date,
    ...(meta.updated ? { updated: meta.updated } : {}),
    excerpt: meta.excerpt,
    ...(meta.coverImage ? { coverImage: meta.coverImage } : {}),
    ...(meta.tags.length ? { tags: meta.tags } : {}),
    published: meta.published,
    ...(meta.focusKeyword ? { focusKeyword: meta.focusKeyword } : {}),
    ...(meta.seo.metaTitle ||
    meta.seo.metaDescription ||
    meta.seo.canonicalUrl ||
    meta.seo.noIndex
      ? { seo: meta.seo }
      : {}),
    ...(meta.faq.length ? { faq: meta.faq } : {}),
  };
}

/* ------------------------------ Site config ------------------------------- */

/**
 * Visual theme: one of the curated presets in src/lib/theme.ts, plus admin
 * overrides. `accent` is a hex color ("" = use the preset's brand color);
 * `radius` controls the global corner-radius scale; `headingFont` picks the
 * display font for headings. Applied site-wide via injected CSS variables.
 */
export const themeConfigSchema = z.object({
  preset: z.enum([
    "warm",
    "ocean",
    "forest",
    "midnight",
    "opencode",
    "opencode-dark",
    "claude",
    "claude-dark",
    "minimax",
    "minimax-dark",
  ]).default("warm"),
  accent: z.string().default(""),
  radius: z.enum(["sharp", "soft", "rounded"]).default("soft"),
  headingFont: z.enum(["serif", "sans"]).default("serif"),
});
export type ThemeConfig = z.infer<typeof themeConfigSchema>;

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  preset: "warm",
  accent: "",
  radius: "soft",
  headingFont: "serif",
};

export const siteConfigSchema = z.object({
  title: z.string().default("Ansora"),
  description: z.string().default("A quiet, self-hosted blog."),
  /** Public base URL — canonical links, sitemap, RSS, OG tags. */
  baseUrl: z.string().default("http://localhost:3000"),
  author: z.string().default("Ansora Author"),
  defaultOgImage: z.string().default(""),
  social: z
    .object({
      twitter: z.string().default(""),
      github: z.string().default(""),
      linkedin: z.string().default(""),
    })
    .default({ twitter: "", github: "", linkedin: "" }),
  theme: themeConfigSchema.default(DEFAULT_THEME_CONFIG),
});
export type SiteConfig = z.infer<typeof siteConfigSchema>;

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  title: "Ansora",
  description: "A quiet, self-hosted blog.",
  baseUrl: "http://localhost:3000",
  author: "Ansora Author",
  defaultOgImage: "",
  social: { twitter: "", github: "", linkedin: "" },
  theme: DEFAULT_THEME_CONFIG,
};
