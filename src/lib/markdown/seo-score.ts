/**
 * On-page SEO / AEO scoring engine.
 *
 * Real checks (not placeholders) against title, meta description, focus
 * keyword, heading structure, content length, readability, links, image alt
 * text, FAQ schema and excerpt style. Produces a weighted 0–100 score plus a
 * pass/fail checklist. Pure + dependency-free so it runs in the editor
 * (client-side) and anywhere else.
 */
import { countWords } from "../utils";
import { scanHeadings } from "./pipeline";

export interface SeoCheck {
  id: string;
  label: string;
  passed: boolean;
  hint: string;
  weight: number;
}

export interface SeoScore {
  /** 0–100 */
  score: number;
  checks: SeoCheck[];
}

export interface SeoInput {
  title: string;
  excerpt: string;
  focusKeyword: string;
  slug: string;
  content: string;
  metaDescription: string;
  faqCount: number;
}

const TEASER_STARTS =
  /^(in this (post|article|guide|tutorial)|here['’]?s|let['’]?s|we['’]?ll|we will|welcome|learn (how|about)|discover|explore|a (quick|complete|beginner['’]?s) guide|everything you need)/i;

function hasKeyword(text: string, keyword: string): boolean {
  if (!keyword) return false;
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function metaDescriptionUsed(input: SeoInput): string {
  return input.metaDescription.trim() || input.excerpt.trim();
}

export function computeSeoScore(input: SeoInput): SeoScore {
  const checks: SeoCheck[] = [];
  const kw = input.focusKeyword.trim();
  const words = countWords(input.content);
  const metaUsed = metaDescriptionUsed(input);
  const title = input.title.trim();
  const excerpt = input.excerpt.trim();

  const add = (
    id: string,
    label: string,
    weight: number,
    passed: boolean,
    hint: string
  ) => checks.push({ id, label, passed, hint, weight });

  /* --- Focus keyword ---------------------------------------------------- */
  add(
    "kw-set",
    "Focus keyword is set",
    5,
    !!kw,
    "Add a focus keyword in the SEO panel — it powers most other checks."
  );

  /* --- Title ------------------------------------------------------------- */
  add("title-present", "Title is present", 4, !!title, "Add a title.");
  const titleLen = title.length;
  add(
    "title-length",
    "Title is 30–60 characters",
    8,
    titleLen >= 30 && titleLen <= 60,
    `Current length: ${titleLen} chars. Aim for 30–60 for full SERP display.`
  );
  add(
    "kw-in-title",
    "Focus keyword appears in the title",
    7,
    hasKeyword(title, kw),
    "Include your focus keyword in the title."
  );

  /* --- Meta description -------------------------------------------------- */
  add(
    "meta-present",
    "Meta description is set",
    4,
    !!metaUsed,
    "Write a meta description (or use the excerpt as fallback)."
  );
  const metaLen = metaUsed.length;
  add(
    "meta-length",
    "Meta description is 120–160 characters",
    8,
    metaLen >= 120 && metaLen <= 160,
    `Current length: ${metaLen} chars. Aim for 120–160.`
  );
  add(
    "kw-in-meta",
    "Focus keyword appears in the meta description",
    5,
    hasKeyword(metaUsed, kw),
    "Mention the focus keyword in the meta description."
  );

  /* --- Keyword in body ---------------------------------------------------- */
  const first100 = input.content.split(/\s+/).slice(0, 100).join(" ");
  add(
    "kw-in-first100",
    "Focus keyword appears in the first 100 words",
    7,
    hasKeyword(first100, kw),
    "Mention the focus keyword early in the post."
  );
  const headings = scanHeadings(input.content);
  add(
    "kw-in-heading",
    "Focus keyword appears in at least one heading",
    7,
    headings.some((h) => hasKeyword(h.text, kw)),
    "Use the focus keyword in at least one heading."
  );
  const slugKeyword = kw.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "");
  add(
    "kw-in-slug",
    "Focus keyword appears in the URL slug",
    4,
    !!kw && (input.slug.includes(slugKeyword) || hasKeyword(input.slug, kw)),
    "Include the focus keyword in the slug."
  );

  /* --- Heading structure --------------------------------------------------- */
  const h1s = headings.filter((h) => h.level === 1);
  add(
    "no-h1-body",
    "No H1 in the body (the title is the H1)",
    3,
    h1s.length === 0,
    "Remove H1 headings from the body — the page title already fills that role."
  );
  let skipped = false;
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const curr = headings[i].level;
    if (curr > prev + 1) skipped = true; // e.g. h2 -> h4
  }
  add(
    "heading-hierarchy",
    "Heading levels don't skip (h2 → h3, not h2 → h4)",
    4,
    !skipped,
    "Keep heading levels sequential — no skipped levels."
  );

  /* --- Content -------------------------------------------------------------- */
  add(
    "content-length",
    "Content is at least 300 words",
    8,
    words >= 300,
    `Current word count: ${words}. Posts under ~300 words are thin content.`
  );

  /* --- Readability (simplified Flesch-style heuristic) ----------------------- */
  const paragraphs = input.content
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[#>*`~\-=]+/g, " ").trim())
    .filter(Boolean);
  const sentences = input.content
    .split(/[.!?]+\s+/)
    .map((s) => s.split(/\s+/).filter(Boolean).length)
    .filter((n) => n > 0);
  const avgSentenceWords =
    sentences.length > 0
      ? sentences.reduce((a, b) => a + b, 0) / sentences.length
      : 0;
  const longParagraph = paragraphs.some((p) => countWords(p) > 150);
  add(
    "readability",
    "Readable: sentences ≤ ~25 words, no 150+ word paragraphs",
    5,
    avgSentenceWords <= 25 && !longParagraph,
    longParagraph
      ? "Break up paragraphs over ~150 words."
      : `Average sentence: ${avgSentenceWords.toFixed(0)} words — aim for ≤ 25.`
  );

  /* --- Links ----------------------------------------------------------------- */
  const linkMatches = input.content.match(/\[[^\]]*\]\(([^)\s]+)\)/g) ?? [];
  const linkUrls = linkMatches.map((m) => (m.match(/\(([^)\s]+)\)/) ?? ["", ""])[1]);
  const hasAnyLink = linkUrls.length > 0;
  add(
    "links",
    "Post contains internal or external links",
    5,
    hasAnyLink,
    "Add at least one internal or external link."
  );

  /* --- Images ------------------------------------------------------------------ */
  const imageMatches = input.content.match(/!\[([^\]]*)\]\(([^)\s]+)\)/g) ?? [];
  const missingAlt = imageMatches.some((m) => {
    const alt = (m.match(/^!\[([^\]]*)\]/) ?? ["", ""])[1];
    return alt.trim() === "";
  });
  add(
    "image-alt",
    "All images have alt text",
    5,
    imageMatches.length === 0 || !missingAlt,
    "Every image needs descriptive alt text — it feeds both SEO and accessibility."
  );

  /* --- AEO ----------------------------------------------------------------------- */
  add(
    "faq-if-long",
    "FAQ block present (posts over 500 words)",
    6,
    words <= 500 || input.faqCount > 0,
    "Posts over ~500 words rank better in AI answers with an FAQ schema block."
  );
  const declarative =
    !!excerpt &&
    !/^[?¿]/.test(excerpt) &&
    !TEASER_STARTS.test(excerpt);
  add(
    "excerpt-declarative",
    "Excerpt reads as a direct, quotable answer",
    5,
    declarative,
    "Start the excerpt with a declarative sentence that answers a likely question — avoid teasers like “In this post we’ll explore…”."
  );

  /* --- Slug sanity is handled by the kw-in-slug check above. --------------- */

  const earned = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  const total = checks.reduce((sum, c) => sum + c.weight, 0);
  return { score: Math.round((earned / total) * 100), checks };
}
