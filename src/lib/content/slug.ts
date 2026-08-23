/**
 * Slug safety gate for the content adapters.
 *
 * Slugs become file names on disk (`<slug>.md`) and repo paths in serverless
 * mode (`<postsPath>/<slug>.md`). Every adapter entry point validates slugs
 * here so a hostile value (`../../etc/passwd`, `a/b`, empty) can never escape
 * the posts directory or write outside the configured path — regardless of
 * which caller (public page read or admin API write) supplied it.
 */
import { SLUG_PATTERN } from "../utils";

/** True when a slug is a plain lower-kebab-case token, safe as a file name. */
export function isSafeSlug(slug: unknown): slug is string {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= 200 &&
    SLUG_PATTERN.test(slug)
  );
}
