import type { MetadataRoute } from "next";
import { getAdapter } from "@/lib/content";
import { getSiteConfig } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, config] = await Promise.all([
    getAdapter().listPosts(),
    getSiteConfig(),
  ]);
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const published = posts.filter((p) => p.published);

  const urls: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/tags`, changeFrequency: "weekly", priority: 0.5 },
  ];

  for (const post of published) {
    urls.push({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.updated || post.date,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  const tagSet = new Set<string>();
  for (const post of published) post.tags.forEach((t) => tagSet.add(t));
  for (const tag of tagSet) {
    urls.push({
      url: `${baseUrl}/tags/${tag}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return urls;
}
