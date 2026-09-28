import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/site-config";

/**
 * robots.txt
 *
 * The AI-crawler stance is deliberate and permissive: a single `*` group with no
 * bot-specific `Disallow` means GPTBot, OAI-SearchBot, ChatGPT-User,
 * PerplexityBot, ClaudeBot, anthropic-ai, Google-Extended, Bingbot and CCBot
 * are all welcome. Blocking any of the search-and-cite bots would make the
 * engine physically unable to cite this site, which defeats the point of an
 * llms.txt that ships alongside it.
 *
 * Only genuinely private or redundant surfaces are closed:
 *   /admin  the login panel and dashboard
 *   /api    session-bearing JSON endpoints
 *   /md     the markdown content-negotiation mirror (duplicates the HTML routes)
 *
 * The search index is deliberately NOT disallowed: it is built from the same
 * `isIndexable()` set as the sitemap, so it contains nothing that is not
 * already public, and it is how a crawler can enumerate every post title.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await getSiteConfig();
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/md"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
