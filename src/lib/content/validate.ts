/**
 * Shared validation for admin save operations (create + update).
 * Keeps slug derivation, uniqueness checks and publish rules in one place.
 */
import { getAdapter } from "./index";
import {
  postMetaSchema,
  serializeFrontmatter,
  type Post,
  type PostMeta,
} from "./types";
import { slugify, SLUG_PATTERN } from "../utils";

export interface SavePayload {
  meta: PostMeta;
  body: string;
}

export function parseSavePayload(body: unknown): SavePayload {
  const raw = (body ?? {}) as { meta?: unknown; body?: unknown };
  const parsed = postMetaSchema.safeParse(raw.meta ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new PayloadError(
      `Invalid post data: ${first?.path?.join(".") ?? "meta"} — ${first?.message ?? "check the fields"}`
    );
  }
  return { meta: parsed.data, body: String(raw.body ?? "") };
}

/** Derive a valid slug from the meta (or fall back to the title). */
export function deriveSlug(meta: PostMeta, fallback = "untitled-post"): string {
  const base = meta.slug || slugify(meta.title) || fallback;
  const slug = slugify(base) || fallback;
  return SLUG_PATTERN.test(slug) ? slug : fallback;
}

export class PayloadError extends Error {}

/** Throw if a post is being published without required fields. */
export function assertPublishable(meta: PostMeta): void {
  if (!meta.published) return;
  if (!meta.title.trim()) {
    throw new PayloadError("A title is required before publishing.");
  }
  if (!meta.excerpt.trim()) {
    throw new PayloadError("An excerpt is required before publishing.");
  }
}

/**
 * True when a save carries no real changes — same body, and a canonical
 * serialization of the frontmatter that ignores the derived `updated` stamp.
 * Used by the update route to skip no-op saves entirely (no commit, no
 * re-stamping of `updated`), mirroring the local adapter's git behavior.
 */
export function isUnchangedPost(
  existing: Post,
  meta: PostMeta,
  body: string
): boolean {
  if (existing.content !== body) return false;
  const a = serializeFrontmatter({ ...existing.meta, updated: undefined });
  const b = serializeFrontmatter({ ...meta, updated: undefined });
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Ensure a slug is not already used by a *different* post. */
export async function assertSlugFree(
  slug: string,
  currentSlug?: string
): Promise<void> {
  const existing = await getAdapter().listPosts();
  if (existing.some((p) => p.slug === slug && p.slug !== currentSlug)) {
    throw new PayloadError(
      `A post with the slug “${slug}” already exists — pick a different one.`
    );
  }
}
