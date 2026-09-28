import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { Pagination } from "@/components/Pagination";
import { PostCard } from "@/components/PostCard";
import { safeListPosts } from "@/lib/content";
import { buildListingGraph, homeUrl } from "@/lib/seo/jsonld";
import { withFeeds } from "@/lib/seo/metadata";
import { getSiteConfig } from "@/lib/site-config";

const PAGE_SIZE = 9;

// `/` reads `searchParams` to paginate, and in the App Router that opts the
// route into dynamic rendering, so it cannot also be an ISR route. That is
// pre-existing behavior, not a regression, and it is now stated explicitly
// rather than left implicit. Every *other* public route (blog index, tags
// index, about, post pages) is ISR at 300s. The adapter's own TTL cache means
// the dynamic render is a warm read, not a fresh fetch per hit.
//
// Making this static would mean moving to /page/2 style paths, which would
// invalidate the `?page=N` URLs existing deployments already have indexed.
// Not worth it.
export const dynamic = "force-dynamic";

async function resolvePage(pageParam?: string): Promise<number> {
  const parsed = parseInt(pageParam ?? "1", 10);
  return Math.max(1, Number.isFinite(parsed) ? parsed : 1);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { page: pageParam } = await searchParams;
  const page = await resolvePage(pageParam);
  const config = await getSiteConfig();
  // Each paginated URL self-canonicalizes. Without this, `/?page=2` is a
  // duplicate of `/` with an identical title and description.
  const url = page === 1 ? homeUrl(config) : `${homeUrl(config)}?page=${page}`;
  const suffix = page === 1 ? "" : ` - page ${page}`;
  return {
    // `absolute` because the root layout applies a `%s · <site title>` template;
    // a plain string would render the home title as "Ansora · Ansora".
    title: { absolute: `${config.title}${suffix}` },
    description: config.description,
    alternates: withFeeds(config, url),
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = await resolvePage(pageParam);
  const [posts, config] = await Promise.all([
    safeListPosts(),
    getSiteConfig(),
  ]);
  const published = posts.filter((p) => p.published);
  const totalPages = Math.max(1, Math.ceil(published.length / PAGE_SIZE));
  const pagePosts = published.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const graph = buildListingGraph(config, pagePosts, {
    name: config.title,
    url: homeUrl(config),
    description: config.description,
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd graph={graph} />

      <section className="mb-12 max-w-2xl">
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {config.title}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-muted">
          {config.description}
        </p>
      </section>

      {pagePosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong p-12 text-center">
          <p className="font-serif text-xl text-ink">Nothing published yet.</p>
          <p className="mt-2 text-sm text-ink-muted">
            Head to the admin panel and write your first post &mdash; or just enjoy
            the quiet.
          </p>
        </div>
      ) : (
        <section
          aria-label="Posts"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {pagePosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </section>
      )}

      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}
