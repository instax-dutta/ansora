import type { Metadata } from "next";
import type { SiteConfig } from "@/lib/content/types";

/**
 * Shared metadata helpers.
 *
 * Why this file exists: in Next.js 16 a page's `generateMetadata` **replaces**
 * `alternates` rather than deep-merging it with the root layout's. So a page
 * that sets `alternates: { canonical }` silently drops the root's feed
 * autodiscovery links, and RSS readers stop discovering the feed on exactly
 * the pages that matter.
 *
 * The rule that follows: every route that returns `alternates` must build it
 * with `withFeeds()`. The root layout keeps the same links as a default for
 * routes that declare no metadata of their own (e.g. the admin login page).
 */

export type FeedAlternateTypes = NonNullable<
  NonNullable<Metadata["alternates"]>["types"]
>;

/** The three feed/document types a reader or agent can autodiscover. */
export function feedAlternateTypes(config: SiteConfig): FeedAlternateTypes {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  return {
    "application/rss+xml": [
      { url: `${baseUrl}/rss.xml`, title: `${config.title} (RSS)` },
    ],
    "application/feed+json": [
      { url: `${baseUrl}/feed.json`, title: `${config.title} (JSON Feed)` },
    ],
    "text/plain": [
      { url: `${baseUrl}/llms.txt`, title: `${config.title} for AI agents` },
    ],
  };
}

/** Page alternates that always carry the feed links alongside the canonical. */
export function withFeeds(
  config: SiteConfig,
  canonical?: string
): NonNullable<Metadata["alternates"]> {
  return {
    ...(canonical ? { canonical } : {}),
    types: feedAlternateTypes(config),
  };
}
