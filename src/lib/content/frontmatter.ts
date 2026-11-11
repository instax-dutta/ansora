/**
 * Frontmatter-only reads.
 *
 * A listing needs the frontmatter of every post and nothing else, but the
 * frontmatter lives *inside* the file, so the only way to get it is to read
 * the file. Reading the whole file to parse 40 lines of YAML is pure waste:
 * on a 90-post blog the bodies are 1.7 MB and the frontmatter is 26% of that.
 *
 * Frontmatter is always the first thing in the file, so a byte-range request
 * for the first few KB is enough. This module owns the one hard part — knowing
 * whether the window actually contains the *whole* frontmatter block, so a
 * caller can fall back to a full read instead of parsing half a YAML document.
 */

/** How many bytes of the file head we ask for. */
export const FRONTMATTER_WINDOW_BYTES = 16384;

/**
 * Whether the head we fetched holds the complete frontmatter.
 *
 * - `complete` — the block starts at byte 0 and closes inside the window.
 * - `none` — the file has no frontmatter at all, so the head is enough.
 * - `truncated` — the block starts but does not close inside the window. The
 *   head is NOT enough: parsing it would read half a YAML document.
 */
export type FrontmatterHeadStatus = "complete" | "none" | "truncated";

/**
 * A frontmatter block: `---` on the first line, a body, and a closing `---`
 * on its own line. Matches gray-matter's own shape (delimiter lines may carry
 * trailing whitespace).
 */
const FRONTMATTER_BLOCK = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Classify a fetched file head.
 *
 * The BOM is skipped because gray-matter tolerates it and some editors add it;
 * a file that starts with a BOM then `---` still has frontmatter.
 */
export function frontmatterHeadStatus(text: string): FrontmatterHeadStatus {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (!body.startsWith("---")) return "none";
  return FRONTMATTER_BLOCK.test(body) ? "complete" : "truncated";
}

/**
 * True when the head contains the whole frontmatter block.
 *
 * `truncated` is the only unsafe case: it means the block continues past the
 * window, so the caller must read the whole file before parsing.
 */
export function headHasCompleteFrontmatter(text: string): boolean {
  return frontmatterHeadStatus(text) !== "truncated";
}
