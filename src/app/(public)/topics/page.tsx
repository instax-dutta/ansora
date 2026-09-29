import type { Metadata } from "next";
import Link from "next/link";
import { ContentUnavailable } from "@/components/ContentUnavailable";
import { JsonLd } from "@/components/JsonLd";
import { PostCard } from "@/components/PostCard";
import { safeListPosts } from "@/lib/content";
import type { PostMeta } from "@/lib/content/types";
import { buildListingGraph, topicsUrl } from "@/lib/seo/jsonld";
import { withFeeds } from "@/lib/seo/metadata";
import { MIN_POSTS_FOR_TAG_INDEX } from "@/lib/seo/publish";
import { getSiteConfig } from "@/lib/site-config";
import { tagSlug } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const title = `Topics`;
  return {
    title,
    description: `Every topic covered on ${config.title}, grouped by how much has been written about each one.`,
    alternates: withFeeds(config, topicsUrl(config)),
  };
}

/**
 * The topic hub.
 *
 * `/tags` is a flat alphabetical-ish list; on a real blog that becomes dozens
 * of one-post entries nobody navigates. This page ranks topics by post count
 * instead, so the subjects with actual depth surface first and the long tail
 * collapses into a compact secondary block. That ordering is the point: it is
 * the same signal the indexability threshold uses, made legible.
 */
export default async function TopicsPage() {
  const [posts, config] = await Promise.all([safeListPosts(), getSiteConfig()]);
  const published = posts.filter((p) => p.published);

  const counts = new Map<string, number>();
  for (const post of published) {
    for (const tag of post.tags) {
      if (tag.trim()) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  const primary = ranked.filter(([, c]) => c >= MIN_POSTS_FOR_TAG_INDEX);
  const secondary = ranked.filter(([, c]) => c < MIN_POSTS_FOR_TAG_INDEX);

  const graph = buildListingGraph(config, published, {
    name: `Topics on ${config.title}`,
    url: topicsUrl(config),
    description: `Every topic covered on ${config.title}, grouped by depth.`,
  });

  const renderTag = ([tag, count]: [string, number]) => (
    <li key={tag}>
      <Link
        href={`/tags/${tagSlug(tag)}`}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:text-brand"
      >
        {tag}
        <span className="rounded-full bg-brand-soft px-1.5 text-xs font-semibold text-brand-strong">
          {count}
        </span>
      </Link>
    </li>
  );

  if (published.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Topics
        </h1>
        <div className="mt-8">
          <ContentUnavailable />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd graph={graph} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/" className="transition-colors hover:text-brand">
          {config.title}
        </Link>
        <span aria-hidden="true" className="mx-1.5">
          /
        </span>
        <span className="text-ink">Topics</span>
      </nav>

      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Topics
      </h1>
      <p className="mt-3 max-w-2xl text-ink-muted">
        {ranked.length} topics across {published.length} posts. The{" "}
        {primary.length} with real depth come first.
      </p>

      {primary.length > 0 && (
        <section aria-labelledby="primary-topics" className="mt-10">
          <h2
            id="primary-topics"
            className="text-xs font-semibold uppercase tracking-wider text-ink-muted"
          >
            Covered in depth
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">{primary.map(renderTag)}</ul>
        </section>
      )}

      {primary.length > 0 && secondary.length > 0 && (
        <section aria-labelledby="more-topics" className="mt-10">
          <h2
            id="more-topics"
            className="text-xs font-semibold uppercase tracking-wider text-ink-muted"
          >
            Also covered
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">{secondary.map(renderTag)}</ul>
        </section>
      )}

      {primary.length > 0 && (
        <section aria-labelledby="topic-posts" className="mt-14">
          <h2
            id="topic-posts"
            className="font-serif text-xl font-semibold text-ink"
          >
            Most covered
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            Everything written about {primary[0][0]}.
          </p>
          <TopicPosts posts={published} tag={primary[0][0]} />
        </section>
      )}
    </div>
  );
}

/** Posts carrying a given tag, in publication order. */
function TopicPosts({ posts, tag }: { posts: PostMeta[]; tag: string }) {
  const tagged = posts.filter((p) => p.tags.includes(tag));
  if (tagged.length === 0) return null;
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {tagged.map((post) => (
        <PostCard key={post.slug} post={post} />
      ))}
    </div>
  );
}
