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

/**
 * A cited source rendered as a visible attribution list. Attribution is the
 * single strongest GEO lever, so sources get first-class structure rather than
 * being left as anonymous links in the body.
 */
export const sourceItemSchema = z.object({
  title: z.string().default(""),
  url: z.string().default(""),
  author: z.string().default(""),
  year: z.string().default(""),
});
export type SourceItem = z.infer<typeof sourceItemSchema>;

export const postMetaSchema = z.object({
  title: z.string().default(""),
  slug: z.string().default(""),
  /** ISO date string (YYYY-MM-DD or full timestamp). */
  date: z.string().default(() => new Date().toISOString()),
  /** ISO date string, set when a post is edited after publication. */
  updated: z.string().optional(),
  /** Human-readable reason for the last update; surfaced in the post header. */
  updatedReason: z.string().default(""),
  excerpt: z.string().default(""),
  /**
   * 40-60 word direct answer rendered as a callout above the fold and targeted
   * by the `speakable` schema property. The definition-block pattern is what
   * AI citability scorers reward most, so it gets its own field.
   */
  answer: z.string().default(""),
  /** 3-5 bullet strings rendered as a "Key takeaways" block. */
  takeaways: z.array(z.string()).default([]),
  coverImage: z.string().default(""),
  /** Alt text for the cover image. Falls back to the post title. */
  coverImageAlt: z.string().default(""),
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
  sources: z.array(sourceItemSchema).default([]),
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

/**
 * Normalize raw YAML frontmatter (gray-matter may hand us Dates) and validate.
 *
 * Strict: throws on the first invalid field. Correct for the write path, where
 * rejecting bad input is the entire point. Read paths use
 * `normalizeFrontmatterLoose` instead, because a single mistyped field in a
 * single file must not be able to take down the whole site.
 */
export function normalizeFrontmatter(raw: Record<string, unknown>): PostMeta {
  const data: Record<string, unknown> = { ...raw };
  for (const key of ["date", "updated"] as const) {
    const value = data[key];
    if (value instanceof Date) data[key] = value.toISOString();
  }
  return cleanUndefined(postMetaSchema.parse(data)) as PostMeta;
}

export interface FrontmatterProblem {
  field: string;
  /** What was wrong, in one short line. Never includes the value verbatim. */
  issue: string;
}

export interface LooseParseResult {
  meta: PostMeta;
  problems: FrontmatterProblem[];
}

/**
 * Resilient frontmatter parse for **reads**. Never throws.
 *
 * Why this exists, and why it matters more than it looks: `listPosts()`
 * validates every post in the repository. With strict parsing, a single
 * mistyped field in a single file throws out of the loop and `safeListPosts()`
 * degrades the whole site to an empty listing. A blog does not stop working
 * because one post has `answer: 2026` in it, where YAML happily typed that as
 * a number and zod demanded a string. The failure mode is catastrophic and
 * wildly disproportionate to the cause.
 *
 * So reads validate field-by-field and fall back to that field's default,
 * reporting what was wrong. Strict validation is still the right behaviour on
 * the *write* path, where rejecting bad input is the point — see
 * `normalizeFrontmatter`, which still throws.
 */
export function normalizeFrontmatterLoose(
  raw: Record<string, unknown>,
  label?: string
): LooseParseResult {
  // gray-matter hands back real Date objects for unquoted YAML dates.
  const data: Record<string, unknown> = { ...raw };
  for (const key of ["date", "updated"] as const) {
    const value = data[key];
    if (value instanceof Date) data[key] = value.toISOString();
  }
  const problems: FrontmatterProblem[] = [];
  const shape = postMetaSchema.shape as Record<
    string,
    { safeParse?: (v: unknown) => { success: boolean; error?: { issues?: { message?: string }[] } } }
  >;

  for (const [key, value] of Object.entries(data)) {
    const field = shape[key];
    if (!field?.safeParse) continue; // unknown key: not our problem
    const result = field.safeParse(value);
    if (result.success) continue;

    // Fall back to this field's default, so one bad value cannot fail the post
    // and cannot fail the site.
    const fallback = postMetaSchema.parse({});
    (data as Record<string, unknown>)[key] = (fallback as unknown as Record<string, unknown>)[key];
    problems.push({
      field: key,
      issue: result.error?.issues?.[0]?.message ?? "invalid value",
    });
  }

  if (problems.length > 0 && label) {
    console.warn(
      `[content] frontmatter in "${label}" had ${problems.length} invalid field(s), ` +
        `defaulted: ${problems.map((p) => p.field).join(", ")}. The post is still published; ` +
        `fix the field to restore it.`
    );
  }

  try {
    return { meta: cleanUndefined(postMetaSchema.parse(data)) as PostMeta, problems };
  } catch {
    // Unreachable in practice: every field is now individually valid. Belt and
    // braces — a read must still not take the site down.
    return { meta: postMetaSchema.parse({}) as PostMeta, problems };
  }
}

/** Canonical order + shape used when serializing frontmatter back to YAML. */
export function serializeFrontmatter(meta: PostMeta): Record<string, unknown> {
  return {
    title: meta.title,
    slug: meta.slug,
    date: meta.date,
    ...(meta.updated ? { updated: meta.updated } : {}),
    ...(meta.updatedReason ? { updatedReason: meta.updatedReason } : {}),
    excerpt: meta.excerpt,
    ...(meta.answer ? { answer: meta.answer } : {}),
    ...(meta.takeaways.length
      ? { takeaways: meta.takeaways.filter((t) => t.trim()) }
      : {}),
    ...(meta.coverImage ? { coverImage: meta.coverImage } : {}),
    ...(meta.coverImageAlt ? { coverImageAlt: meta.coverImageAlt } : {}),
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
    ...(meta.sources.length
      ? { sources: meta.sources.filter((s) => s.title.trim() || s.url.trim()) }
      : {}),
  };
}

/* ------------------------------ Site config ------------------------------- */

/**
 * Visual theme: one of the curated presets in src/lib/theme.ts, plus admin
 * overrides. `accent` is a hex color ("" = use the preset's brand color);
 * `radius` controls the global corner-radius scale; `headingFont` picks the
 * display font for headings. Applied site-wide via injected CSS variables.
 */
/** "" = use the preset accent; otherwise a 3- or 6-digit hex color. */
const HEX_COLOR = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

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
  // Strict hex so an arbitrary string can never ride into the injected CSS.
  // (resolveTheme guards this too — belt and braces.)
  accent: z
    .string()
    .default("")
    .refine((v) => v === "" || HEX_COLOR.test(v), {
      message: "Accent must be empty or a hex color like #b04e14.",
    }),
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

/** Must be an absolute http(s) URL — it feeds canonical tags, sitemap, RSS. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const siteConfigSchema = z.object({
  title: z.string().default("Ansora"),
  description: z.string().default("A quiet, self-hosted blog."),
  /** Public base URL — canonical links, sitemap, RSS, OG tags. */
  baseUrl: z
    .string()
    .default("http://localhost:3000")
    .refine(isHttpUrl, {
      message: "Base URL must be an absolute http(s) URL.",
    }),
  author: z.string().default("Ansora Author"),
  /** Short bio for the author entity, rendered on /about. */
  authorBio: z.string().default(""),
  /** Role or credential line, e.g. "Staff engineer, ex-…". */
  authorRole: z.string().default(""),
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
  authorBio: "",
  authorRole: "",
  defaultOgImage: "",
  social: { twitter: "", github: "", linkedin: "" },
  theme: DEFAULT_THEME_CONFIG,
};
