import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { PostCard } from "@/components/PostCard";
import { safeListPosts } from "@/lib/content";
import type { PostMeta } from "@/lib/content/types";
import { buildTagGraph, tagUrl } from "@/lib/seo/jsonld";
import { withFeeds } from "@/lib/seo/metadata";
import { MIN_POSTS_FOR_TAG_INDEX } from "@/lib/seo/publish";
import { getSiteConfig } from "@/lib/site-config";
import { resolveTagFromSlug } from "@/lib/utils";

export const revalidate = 300;
export const dynamicParams = true;

/**
 * Resolve a `/tags/<slug>` param to the raw tag it refers to.
 *
 * Backward compatibility: tag URLs used to be the raw tag string, so existing
 * blogs have links like `/tags/SEO` and `/tags/Search%20Engine%20Optimization`
 * out in the wild. Resolution is slug-based, so every one of those still
 * renders, and the canonical below consolidates them onto the normalized URL.
 * Tags that are already URL-safe resolve to themselves, so nothing about them
 * changes.
 */
async function resolveTag(param: string): Promise<{ tag: string | null }> {
  const posts = await safeListPosts();
  const allTags = [...new Set(posts.flatMap((p) => p.tags))].filter((t) => t.trim());
  return { tag: resolveTagFromSlug(allTags, param) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag: param } = await params;
  const [config, { tag }] = await Promise.all([
    getSiteConfig(),
    resolveTag(param),
  ]);
  if (!tag) return { title: "Tag not found", robots: { index: false, follow: true } };

  const posts = await safeListPosts();
  const tagged = posts.filter((p) => p.published && p.tags.includes(tag));

  return {
    title: `Posts tagged "${tag}"`,
    description: `All published posts on ${config.title} tagged "${tag}".`,
    // Canonicalize onto the normalized slug so legacy raw-tag URLs consolidate
    // here instead of competing with each other.
    alternates: withFeeds(config, tagUrl(config, tag)),
    // A tag page with no posts is empty; one with a single post is a
    // near-duplicate of that post. Both stay crawlable via the tag links on
    // every post, but neither earns an index. See MIN_POSTS_FOR_TAG_INDEX.
    robots: tagged.length < MIN_POSTS_FOR_TAG_INDEX
      ? { index: false, follow: true }
      : undefined,
    openGraph: {
      title: `Posts tagged "${tag}"`,
      description: `All published posts on ${config.title} tagged "${tag}".`,
      url: tagUrl(config, tag),
    },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag: param } = await params;
  const [posts, config, { tag }] = await Promise.all([
    safeListPosts(),
    getSiteConfig(),
    resolveTag(param),
  ]);
  // A slug that matches no tag at all is a genuine 404.
  if (!tag) notFound();

  const tagged: PostMeta[] = posts.filter(
    (p) => p.published && p.tags.includes(tag)
  );
  const graph = buildTagGraph(config, tag, tagged);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd graph={graph} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/tags" className="transition-colors hover:text-brand">
          Tags
        </Link>
        <span aria-hidden="true" className="mx-1.5">
          /
        </span>
        <span className="text-ink">{tag}</span>
      </nav>

      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Posts tagged &ldquo;{tag}&rdquo;
      </h1>
      <p className="mt-3 text-ink-muted">
        {tagged.length} {tagged.length === 1 ? "post" : "posts"} on {config.title}.
      </p>

      {tagged.length > 0 ? (
        <section
          aria-label={`Posts tagged ${tag}`}
          className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {tagged.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </section>
      ) : (
        <p className="mt-10 rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-ink-muted">
          Nothing published under this topic yet.
        </p>
      )}
    </div>
  );
}
