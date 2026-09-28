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

  // Only tags that clear the minimum-post bar get a URL. A tag whose posts are
  // all drafts is noindex; a tag with a single post is a near-duplicate of that
  // post. Both stay reachable via the tag links on every post.
  for (const tag of indexableTags(indexable)) {
    urls.push({
      url: tagUrl(config, tag),
      lastModified: newest,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return urls;
}
