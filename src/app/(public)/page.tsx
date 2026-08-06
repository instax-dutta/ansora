import { Pagination } from "@/components/Pagination";
import { PostCard } from "@/components/PostCard";
import { getAdapter } from "@/lib/content";
import { getSiteConfig } from "@/lib/site-config";


const PAGE_SIZE = 9;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [posts, config] = await Promise.all([
    getAdapter().listPosts(),
    getSiteConfig(),
  ]);
  const published = posts.filter((p) => p.published);
  const totalPages = Math.max(1, Math.ceil(published.length / PAGE_SIZE));
  const pagePosts = published.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
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
            Head to the admin panel and write your first post — or just enjoy
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
