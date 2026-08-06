/**
 * Small shared helpers. No side effects — safe to import from client code.
 */

/** Slugify a string into a URL-safe slug: lowercase, hyphens, [a-z0-9]. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Valid slug: lowercased words separated by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Words in a string (markdown bodies included — code fences count, acceptable). */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Estimated reading time in minutes at ~200 wpm, min 1. */
export function readingTimeMinutes(text: string): number {
  return Math.max(1, Math.round(countWords(text) / 200));
}

/** Human-friendly date for cards and articles. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** ISO date for <time dateTime="…"> and RSS pubDate (RFC 2822). */
export function toRfc2822(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

/** Escape XML special characters (RSS/llms output). */
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Strip markdown formatting from a string for plain-text contexts (excerpts). */
export function stripMarkdown(input: string): string {
  return input
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1") // code spans
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^>\s?/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "") // list bullets
    .replace(/^\s*\d+\.\s+/gm, "") // ordered lists
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/```[\s\S]*?```/g, "") // fenced code blocks
    .replace(/\s+/g, " ")
    .trim();
}
