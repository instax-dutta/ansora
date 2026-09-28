import type { MetadataRoute } from "next";
import { safeListPosts } from "@/lib/content";
import {
  aboutUrl,
  blogUrl,
  homeUrl,
  postUrl,
  tagUrl,
  tagsUrl,
  topicsUrl,
} from "@/lib/seo/jsonld";
import { indexableTags, isIndexable } from "@/lib/seo/publish";
import { getSiteConfig } from "@/lib/site-config";

/**
 * ISR, not a build-time bake.
 *
 * Left static, this route is frozen at build time and served from the CDN
 * forever after. A build that runs without working content credentials — a
 * transient GitHub outage, a missing env var on a fork — would bake a valid but
 * empty sitemap that never corrects itself. That failure is silent: the file
 * still parses, it just stops advertising anything. Re-validating on the same
 * 300s cadence as the public pages means a bad build heals on its own.
 */
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Degrade to a minimal sitemap if the content adapter is unreachable
  // (e.g. a serverless build without GITHUB_REPO/GITHUB_TOKEN) — never fail
  // the build or serve a broken 500 for a sitemap.
  const [posts, config] = await Promise.all([
    safeListPosts(),
    getSiteConfig(),
  ]);
  // `isIndexable` (not just `published`): a post marked seo.noIndex must not be
  // advertised for indexing here, or the opt-out is meaningless.
  const indexable = posts.filter(isIndexable);
  const newest = indexable
    .map((p) => p.updated || p.date)
    .sort()
    .pop();

  const urls: MetadataRoute.Sitemap = [
    {
      url: homeUrl(config),
      lastModified: newest,
      changeFrequency: "daily",
      priority: 1,
    },
    { url: blogUrl(config), changeFrequency: "daily", priority: 0.9 },
    { url: tagsUrl(config), changeFrequency: "weekly", priority: 0.5 },
    { url: topicsUrl(config), changeFrequency: "weekly", priority: 0.6 },
    { url: aboutUrl(config), changeFrequency: "monthly", priority: 0.4 },
  ];

  for (const post of indexable) {
    const entry: MetadataRoute.Sitemap[number] = {
      url: postUrl(config, post.slug),
      lastModified: post.updated || post.date,
      changeFrequency: "monthly",
      priority: 0.8,
    };
    // Image entries help image-bearing results. Next's typed sitemap route
    // accepts plain URLs only (no caption/title fields).
    const image = post.coverImage || config.defaultOgImage;
    if (image) entry.images = [image];
    urls.push(entry);
  }

  // Only tags that clear the minimum-post bar get a URL. `indexableTags()`
  // filters by indexability itself, so drafts and noIndex posts can never
  // contribute a tag here.
  for (const tag of indexableTags(posts)) {
    urls.push({
      url: tagUrl(config, tag),
      lastModified: newest,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return urls;
}
