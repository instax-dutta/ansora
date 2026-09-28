import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PostCard } from "@/components/PostCard";
import { safeListPosts } from "@/lib/content";
import { buildListingGraph, blogUrl } from "@/lib/seo/jsonld";
import { withFeeds } from "@/lib/seo/metadata";
import { getSiteConfig } from "@/lib/site-config";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const title = `All posts`;
  return {
    title,
    description: `Every post published on ${config.title}, newest first.`,
    alternates: withFeeds(config, blogUrl(config)),
  };
}

/**
 * The post index. `/blog` is the pillar URL for the whole cluster: it gives the
 * breadcrumb in every post's JSON-LD a real target, and it is one hop from
 * every post instead of one hop from the home page.
 */
export default async function BlogIndexPage() {
  const [posts, config] = await Promise.all([safeListPosts(), getSiteConfig()]);
  const published = posts
    .filter((p) => p.published)
    .sort((a, b) => b.date.localeCompare(a.date));
  const graph = buildListingGraph(config, published, {
    name: `All posts on ${config.title}`,
    url: blogUrl(config),
    description: `Every post published on ${config.title}, newest first.`,
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd graph={graph} />

      <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        All posts
      </h1>
      <p className="mt-3 text-ink-muted">
        {published.length} {published.length === 1 ? "post" : "posts"} on{" "}
        {config.title}.
      </p>

      {published.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-ink-muted">
          Nothing published yet.
        </p>
      ) : (
        <section
          aria-label="All posts"
          className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {published.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </section>
      )}
    </div>
  );
}
