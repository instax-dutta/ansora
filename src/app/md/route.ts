import { safeListPosts } from "@/lib/content";
import { homeUrl } from "@/lib/seo/jsonld";
import {
  MARKDOWN_RESPONSE_HEADERS,
  buildListingMarkdown,
} from "@/lib/seo/markdown-doc";
import { getSiteConfig } from "@/lib/site-config";

/** Markdown mirror of the home page. See `../md/[...slug]/route.ts`. */
export async function GET() {
  const [posts, config] = await Promise.all([safeListPosts(), getSiteConfig()]);
  const published = posts.filter((p) => p.published);
  return new Response(
    buildListingMarkdown(
      config.title,
      config.description,
      published,
      config,
      homeUrl(config)
    ),
    { headers: MARKDOWN_RESPONSE_HEADERS }
  );
}
