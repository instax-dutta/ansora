import { loadPublishedPost } from "@/lib/content/bodies";
import { safeListPosts } from "@/lib/content";
import { blogUrl } from "@/lib/seo/jsonld";
import {
  MARKDOWN_RESPONSE_HEADERS,
  buildAboutMarkdown,
  buildListingMarkdown,
  buildPostMarkdown,
  buildTagMarkdown,
  buildTagsIndexMarkdown,
} from "@/lib/seo/markdown-doc";
import { getSiteConfig } from "@/lib/site-config";
import { resolveTagFromSlug } from "@/lib/utils";

/**
 * Markdown mirror of the public site, reached through content negotiation:
 * a request with `Accept: text/markdown` for a public HTML route is rewritten
 * here (see the `rewrites()` block in next.config.ts).
 *
 * Reached directly it is still a normal, valid route, so agents that prefer
 * explicit paths can use them. It sends `X-Robots-Tag: noindex, follow` because
 * it duplicates the HTML route and must not compete with it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const [config] = await Promise.all([getSiteConfig()]);
  const path = slug.map((s) => s.toLowerCase());

  // /md/about
  if (path.length === 1 && path[0] === "about") {
    return new Response(buildAboutMarkdown(config), {
      headers: MARKDOWN_RESPONSE_HEADERS,
    });
  }

  const posts = await safeListPosts();
  const published = posts.filter((p) => p.published);

  // /md/tags
  if (path.length === 1 && path[0] === "tags") {
    const counts = new Map<string, number>();
    for (const post of published) {
      for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    const entries = [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    return new Response(buildTagsIndexMarkdown(entries, config), {
      headers: MARKDOWN_RESPONSE_HEADERS,
    });
  }

  // /md/tags/<tag> — resolved through the same slug rules as the HTML route so
  // legacy raw-tag URLs keep working here too.
  if (path.length === 2 && path[0] === "tags") {
    const allTags = [...new Set(posts.flatMap((p) => p.tags))].filter((t) =>
      t.trim()
    );
    const tag = resolveTagFromSlug(allTags, slug[1]);
    if (!tag) return new Response("Not found", { status: 404 });
    const tagged = published.filter((p) => p.tags.includes(tag));
    return new Response(buildTagMarkdown(tag, tagged, config), {
      headers: MARKDOWN_RESPONSE_HEADERS,
    });
  }

  // /md/blog
  if (path.length === 1 && path[0] === "blog") {
    return new Response(
      buildListingMarkdown(
        "All posts",
        `Every post published on ${config.title}, newest first.`,
        published,
        config,
        blogUrl(config)
      ),
      { headers: MARKDOWN_RESPONSE_HEADERS }
    );
  }

  // /md/blog/<slug>
  if (path.length === 2 && path[0] === "blog") {
    // Drafts stay private on the markdown mirror too.
    const post = await loadPublishedPost(slug[1]);
    if (!post) return new Response("Not found", { status: 404 });
    return new Response(
      buildPostMarkdown(post.meta, post.content, config),
      { headers: MARKDOWN_RESPONSE_HEADERS }
    );
  }

  return new Response("Not found", { status: 404 });
}
