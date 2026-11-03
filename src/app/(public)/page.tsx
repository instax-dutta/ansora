import type { Metadata } from "next";
import { ContentUnavailable } from "@/components/ContentUnavailable";
import { HomePosts } from "@/components/HomePosts";
import { JsonLd } from "@/components/JsonLd";
import { PostCard, type PostCardData } from "@/components/PostCard";
import { safeListPosts } from "@/lib/content";
import { buildListingGraph, homeUrl } from "@/lib/seo/jsonld";
import { withFeeds } from "@/lib/seo/metadata";
import { getSiteConfig } from "@/lib/site-config";

const PAGE_SIZE = 9;

/**
 * Static, with a one-hour safety net.
 *
 * This route used to be `force-dynamic` because it read `?page=N`, which made
 * every home-page visit a full server render — the single most expensive thing
 * a hobby-tier blog did. Pagination is now handled in the browser
 * (`<HomePosts>`), so the page is prerendered once and served from the CDN.
 *
 * Backward compatibility: `?page=N` URLs still resolve and show the right
 * posts. They are served the same static HTML and the client swaps in the
 * requested slice. The canonical for every page is `/`, consolidating the
 * paginated duplicates onto the one URL.
 *
 * `revalidate` is deliberately not removed: a build that runs without content
 * credentials would otherwise bake an empty home page until the next deploy.
 * An hour is 12x cheaper than the old 5 minutes and still self-heals.
 */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return {
    // `absolute` because the root layout applies a `%s · <site title>` template;
    // a plain string would render the home title as "Ansora · Ansora".
    title: { absolute: config.title },
    description: config.description,
    alternates: withFeeds(config, homeUrl(config)),
  };
}

function toCard(post: Awaited<ReturnType<typeof safeListPosts>>[number]): PostCardData {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    tags: post.tags,
    coverImage: post.coverImage,
  };
}

export default async function HomePage() {
  const [posts, config] = await Promise.all([safeListPosts(), getSiteConfig()]);
  const published = posts.filter((p) => p.published);
  const cards = published.map(toCard);
  const firstPage = published.slice(0, PAGE_SIZE);
  const graph = buildListingGraph(config, published, {
    name: config.title,
    url: homeUrl(config),
    description: config.description,
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd graph={graph} />

      <section className="mb-12 max-w-2xl">
        <h1 className="font-display text-4xl tracking-display text-ink sm:text-5xl">
          {config.title}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-muted">
          {config.description}
        </p>
      </section>

      {published.length === 0 ? (
        <ContentUnavailable />
      ) : (
        <HomePosts posts={cards} pageSize={PAGE_SIZE}>
          <section
            aria-label="Posts"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {firstPage.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </section>
        </HomePosts>
      )}
    </div>
  );
}
