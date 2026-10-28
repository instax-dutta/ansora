import { notFound } from "next/navigation";
import { PostPerformancePanel } from "@/components/admin/analytics/PostPerformancePanel";
import { siteTimezone } from "@/lib/analytics/resolve";
import { getAdapter } from "@/lib/content";
import { isSafeSlug } from "@/lib/content/slug";
import { isIndexable } from "@/lib/seo/publish";
import { readingTimeMinutes } from "@/lib/utils";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

/**
 * Per-post performance.
 *
 * Drafts 404 here, exactly like the public site. Analytics must never become a
 * way to confirm that an unpublished slug exists, let alone read its traffic.
 *
 * The content context (title, tags, indexability, reading time) is rendered on
 * the server so the page is useful even before the report arrives — and so the
 * panel never has to fetch the post body itself.
 */
export default async function PostPerformancePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isSafeSlug(slug)) notFound();

  const adapter = getAdapter();
  const posts = await adapter.listPosts();
  const post = posts.find((entry) => entry.slug === slug && entry.published);
  if (!post) notFound();

  const config = await getSiteConfig();
  const baseUrl = config.baseUrl.replace(/\/+$/, "");

  // One body read, for the reading-time estimate only. Degrades to null.
  const body = await adapter.getPost(slug).catch(() => null);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PostPerformancePanel
        slug={post.slug}
        timezone={siteTimezone()}
        defaults={{
          slug: post.slug,
          title: post.title || post.slug,
          published: post.published,
          noIndex: post.seo.noIndex,
          indexable: isIndexable(post),
          tags: post.tags,
          date: post.date,
          updated: post.updated ?? null,
          updatedReason: post.updatedReason,
          url: `${baseUrl}/blog/${post.slug}`,
          editHref: `/admin/posts/${encodeURIComponent(post.slug)}/edit`,
          readingMinutes: body ? readingTimeMinutes(body.content) : null,
        }}
      />
    </div>
  );
}
