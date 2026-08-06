import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { getAdapter } from "@/lib/content";
import { getSiteConfig } from "@/lib/site-config";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  return {
    title: `Posts tagged “${tag}”`,
    description: `All posts tagged “${tag}”.`,
    robots: { index: true, follow: true },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const [posts, config] = await Promise.all([
    getAdapter().listPosts(),
    getSiteConfig(),
  ]);
  const tagged = posts.filter((p) => p.published && p.tags.includes(tag));
  if (tagged.length === 0 && !posts.some((p) => p.tags.includes(tag))) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
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
        Posts tagged “{tag}”
      </h1>
      <p className="mt-3 text-ink-muted">
        {tagged.length} {tagged.length === 1 ? "post" : "posts"} on {config.title}.
      </p>

      {tagged.length > 0 && (
        <section
          aria-label={`Posts tagged ${tag}`}
          className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {tagged.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </section>
      )}
    </div>
  );
}
