/**
 * Provider path → Ansora post mapping.
 *
 * Providers report whatever the browser asked for: trailing slashes, percent
 * encoding, a full origin, sometimes a draft URL that 404'd. This module is the
 * single deterministic place that turns those into site paths and, when the
 * slug names a **published** post, into post metadata.
 *
 * Two rules it exists to enforce:
 * - a draft slug is never mapped to a post, so the dashboard cannot leak the
 *   existence or title of an unpublished draft;
 * - a stored slug is never rewritten to "fix" analytics. The content model is
 *   the source of truth; the mapper adapts to it.
 */
import type { PostMeta } from "@/lib/content/types";
import { percentChange } from "./normalise";
import type { AnalyticsPageRow, PageKind, PagePostRef } from "./types";

const MAX_PATH_LENGTH = 1024;

/** Split a pathname into decoded segments, or null if anything is unsafe. */
function decodeSegments(pathname: string): string[] | null {
  const out: string[] = [];
  for (const raw of pathname.split("/")) {
    if (!raw) continue;
    let segment = raw;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      // Malformed encoding: keep the raw segment rather than throwing.
      segment = raw;
    }
    if (segment === "." || segment === "..") return null;
    if (segment.includes("/") || segment.includes("\\")) return null;
    if (/[\s\u0000-\u001f]/.test(segment)) return null;
    out.push(segment);
  }
  return out;
}

/**
 * Normalise a provider page value to a site pathname.
 *
 * Returns null for foreign hosts, traversal, whitespace and anything that is
 * not a plausible site path, so a hostile or corrupt value is dropped instead
 * of being displayed as a page of this blog.
 */
export function normalisePath(input: string, baseUrl?: string): string | null {
  if (typeof input !== "string") return null;
  let value = input.trim();
  if (value.length > MAX_PATH_LENGTH) return null;
  if (!value) return "/";

  // `//x` is ambiguous: protocol-relative URL, or a path with duplicate
  // slashes. With a known site origin it is resolvable, so it is compared by
  // host; without one it is treated as a path and normalised.
  const isAbsolute =
    /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || (value.startsWith("//") && !!baseUrl);
  if (isAbsolute) {
    let url: URL;
    try {
      url = new URL(value, baseUrl ?? undefined);
    } catch {
      return null;
    }
    if (baseUrl) {
      let base: URL;
      try {
        base = new URL(baseUrl);
      } catch {
        base = url;
      }
      if (url.host !== base.host) return null;
    }
    value = url.pathname || "/";
  } else {
    // A scheme-like prefix without "//" (javascript:, data:) is never a path.
    const colon = value.indexOf(":");
    const slash = value.indexOf("/");
    if (colon !== -1 && (slash === -1 || colon < slash)) return null;
    const hash = value.indexOf("#");
    if (hash !== -1) value = value.slice(0, hash);
    const query = value.indexOf("?");
    if (query !== -1) value = value.slice(0, query);
    if (!value.startsWith("/")) value = `/${value}`;
  }

  if (value.includes("?") || value.includes("#")) {
    value = value.split("?")[0].split("#")[0];
  }

  const segments = decodeSegments(value);
  if (!segments) return null;
  return segments.length ? `/${segments.join("/")}` : "/";
}

/** Which public route shape is this path? */
export function classifyPath(pathname: string): { kind: PageKind; slug: string | null } {
  if (pathname === "/") return { kind: "home", slug: null };
  if (pathname === "/blog") return { kind: "blog", slug: null };
  if (pathname === "/about") return { kind: "about", slug: null };
  if (pathname === "/tags") return { kind: "tag", slug: null };
  if (pathname.startsWith("/tags/")) {
    return { kind: "tag", slug: pathname.slice("/tags/".length) || null };
  }
  if (pathname.startsWith("/blog/")) {
    const slug = pathname.slice("/blog/".length);
    if (!slug || slug.includes("/")) return { kind: "other", slug: null };
    return { kind: "post", slug };
  }
  return { kind: "other", slug: null };
}

export interface RawPageRow {
  path: string;
  pageviews: number;
  visitors?: number | null;
}

/**
 * Map raw provider rows onto published posts.
 *
 * Rows are merged on the *normalised* path, because `/blog/x` and `/blog/x/`
 * are one page to a reader and two rows to a provider. Rows that resolve to an
 * unpublished slug are kept (they are real requests) but carry no post
 * reference, so no draft title can reach the dashboard.
 */
export function mapPageRowsToPosts(
  rows: RawPageRow[],
  posts: PostMeta[],
  baseUrl?: string
): AnalyticsPageRow[] {
  const published = new Map<string, PostMeta>();
  for (const post of posts) {
    if (post.published) published.set(post.slug, post);
  }

  const merged = new Map<
    string,
    { pageviews: number; visitors: number | null; hasVisitors: boolean }
  >();

  for (const row of rows) {
    const path = normalisePath(row.path, baseUrl);
    if (!path) continue;
    const entry = merged.get(path) ?? { pageviews: 0, visitors: null, hasVisitors: false };
    entry.pageviews += Number.isFinite(row.pageviews) ? Math.max(0, row.pageviews) : 0;
    if (typeof row.visitors === "number" && Number.isFinite(row.visitors)) {
      entry.visitors = (entry.visitors ?? 0) + Math.max(0, row.visitors);
      entry.hasVisitors = true;
    }
    merged.set(path, entry);
  }

  return [...merged.entries()]
    .map(([path, entry]) => {
      const classified = classifyPath(path);
      const meta = classified.kind === "post" && classified.slug
        ? published.get(classified.slug)
        : undefined;
      const post: PagePostRef | null = meta
        ? {
            slug: meta.slug,
            title: meta.title,
            noIndex: meta.seo.noIndex,
            updated: meta.updated ?? null,
          }
        : null;
      return {
        path,
        pageviews: entry.pageviews,
        visitors: entry.hasVisitors ? entry.visitors : null,
        change: null as number | null,
        // An unpublished (or unknown) `/blog/*` path is not a post we own.
        kind: (meta ? "post" : classified.kind === "post" ? "other" : classified.kind) as PageKind,
        post,
      };
    })
    .sort((a, b) => b.pageviews - a.pageviews || a.path.localeCompare(b.path));
}

/**
 * Attach a previous-period change to each row.
 *
 * Paths are normalised again on the previous-period side: matching raw strings
 * would silently produce `null` changes for every trailing-slash variation.
 */
export function withPageChange(
  rows: AnalyticsPageRow[],
  previousRows: RawPageRow[],
  baseUrl?: string
): AnalyticsPageRow[] {
  const previous = new Map<string, number>();
  for (const row of previousRows) {
    const path = normalisePath(row.path, baseUrl);
    if (!path) continue;
    previous.set(path, (previous.get(path) ?? 0) + Math.max(0, row.pageviews));
  }
  return rows.map((row) => ({
    ...row,
    change: percentChange(row.pageviews, previous.get(row.path) ?? 0),
  }));
}
