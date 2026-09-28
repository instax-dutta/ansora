import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { safeListPosts } from "@/lib/content";
import { buildTagsIndexGraph, tagsUrl } from "@/lib/seo/jsonld";
import { withFeeds } from "@/lib/seo/metadata";
import { getSiteConfig } from "@/lib/site-config";
import { tagSlug } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const title = `Tags on ${config.title}`;
  return {
    title,
    description: `Every topic covered on ${config.title}, with post counts.`,
    alternates: withFeeds(config, tagsUrl(config)),
  };
}

export default async function TagsIndexPage() {
  const [posts, config] = await Promise.all([safeListPosts(), getSiteConfig()]);
  const published = posts.filter((p) => p.published);

  const counts = new Map<string, number>();
  for (const post of published) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const tags = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  const graph = buildTagsIndexGraph(
    config,
    tags.map(([tag, count]) => ({ tag, count }))
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd graph={graph} />

      <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Tags
      </h1>
      <p className="mt-3 text-ink-muted">
        Browse posts by topic.
      </p>

      {tags.length === 0 ? (
        <p className="mt-10 text-sm text-ink-muted">No tags yet.</p>
      ) : (
        <ul className="mt-10 flex flex-wrap gap-2.5">
          {tags.map(([tag, count]) => (
            <li key={tag}>
              <Link
                href={`/tags/${tagSlug(tag)}`}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-all hover:-translate-y-0.5 hover:border-line-strong hover:text-brand"
              >
                {tag}
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
                  {count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
