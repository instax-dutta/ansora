import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ProseHtml } from "@/components/ProseHtml";
import { TagLinks } from "@/components/TagLinks";
import { Toc } from "@/components/Toc";
import { getAdapter, safeListPosts } from "@/lib/content";
import { postNeighbours, relatedPosts } from "@/lib/content/related";
import type { SourceItem } from "@/lib/content/types";
import { extractToc } from "@/lib/markdown/pipeline";
import { renderMarkdown } from "@/lib/markdown/render";
import { buildPostGraph, postUrl } from "@/lib/seo/jsonld";
import { withFeeds } from "@/lib/seo/metadata";
import { getSiteConfig } from "@/lib/site-config";
import { countWords, formatDate, readingTimeMinutes } from "@/lib/utils";

export const revalidate = 300;
export const dynamicParams = true;

/** Build-time SSG for self-hosted builds; ISR-on-demand for serverless. */
export async function generateStaticParams() {
  if (process.env.DEPLOYMENT_MODE === "serverless") return [];
  const posts = await getAdapter().listPosts();
  return posts.filter((p) => p.published).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getAdapter().getPost(slug);
  // Drafts and missing posts are indistinguishable to the public site.
  if (!post || !post.meta.published) return { title: "Post not found" };

  const [config] = await Promise.all([getSiteConfig()]);
  const { meta } = post;
  const url = postUrl(config, meta.slug);
  const title = meta.seo.metaTitle || meta.title;
  const description = meta.seo.metaDescription || meta.excerpt;
  const image = meta.coverImage || config.defaultOgImage || undefined;

  return {
    title,
    description,
    alternates: withFeeds(config, meta.seo.canonicalUrl || url),
    robots: meta.seo.noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      url,
      publishedTime: meta.date,
      modifiedTime: meta.updated || meta.date,
      authors: [config.author],
      tags: meta.tags,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

function Sources({ sources }: { sources: SourceItem[] }) {
  const items = sources.filter((s) => s.title.trim() || s.url.trim());
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="sources-heading" className="mt-12">
      <h2
        id="sources-heading"
        className="font-serif text-2xl font-semibold text-ink"
      >
        Sources
      </h2>
      <ol className="mt-4 space-y-2 text-sm">
        {items.map((source, i) => {
          const label =
            [source.author, source.year].filter(Boolean).join(", ") || source.url;
          return (
            <li key={i} className="flex gap-2 text-ink-muted">
              <span aria-hidden="true" className="shrink-0 font-mono text-xs">
                [{i + 1}]
              </span>
              <span>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
                  >
                    {source.title || source.url}
                  </a>
                ) : (
                  <span className="font-medium text-ink">{source.title}</span>
                )}
                {label && <span className="ml-1.5">{label}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, config, allPosts] = await Promise.all([
    getAdapter().getPost(slug),
    getSiteConfig(),
    safeListPosts(),
  ]);
  // Unpublished posts are never served on the public site.
  if (!post || !post.meta.published) notFound();

  const { meta, content } = post;
  const [bodyHtml, toc] = await Promise.all([
    renderMarkdown(content),
    extractToc(content),
  ]);
  const faqItems = meta.faq.filter((f) => f.question);
  const [faqAnswers, takeawaysHtml] = await Promise.all([
    Promise.all(faqItems.map((f) => renderMarkdown(f.answer))),
    Promise.all(
      meta.takeaways
        .filter((t) => t.trim())
        .map((t) => renderMarkdown(`- ${t}`))
    ),
  ]);
  const wordCount = countWords(content);
  const minutes = readingTimeMinutes(content);
  const showToc = wordCount > 800 && toc.length >= 2;
  const answer = meta.answer.trim();
  const related = relatedPosts(allPosts, meta);
  const { newer, older } = postNeighbours(allPosts, meta);
  const graph = buildPostGraph(meta, config, {
    wordCount,
    imageAlt: meta.coverImageAlt,
  });
  const coverAlt = meta.coverImageAlt || meta.title;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className={showToc ? "lg:grid lg:grid-cols-[minmax(0,1fr)_250px] lg:gap-10" : ""}>
        <article>
          {/* Breadcrumb — must mirror the BreadcrumbList in the JSON-LD below */}
          <nav
            aria-label="Breadcrumb"
            className="mb-5 text-sm text-ink-muted"
          >
            <Link href="/" className="transition-colors hover:text-brand">
              {config.title}
            </Link>
            <span aria-hidden="true" className="mx-1.5">
              /
            </span>
            <Link href="/blog" className="transition-colors hover:text-brand">
              Blog
            </Link>
            <span aria-hidden="true" className="mx-1.5">
              /
            </span>
            <span className="text-ink">{meta.title}</span>
          </nav>

          {/* Post header */}
          <header className="mb-8">
            {meta.tags.length > 0 && (
              <TagLinks
                tags={meta.tags}
                className="mb-4 flex flex-wrap gap-1.5"
              />
            )}

            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
              {meta.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <Link
                href="/about"
                className="transition-colors hover:text-brand"
              >
                {config.author}
              </Link>
              <span aria-hidden="true">&middot;</span>
              <time dateTime={meta.date}>{formatDate(meta.date)}</time>
              {meta.updated && meta.updated !== meta.date && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>
                    Updated {formatDate(meta.updated)}
                    {meta.updatedReason ? `: ${meta.updatedReason}` : ""}
                  </span>
                </>
              )}
              <span aria-hidden="true">&middot;</span>
              <span>{minutes} min read</span>
            </div>

            {meta.coverImage && (
              // Raw <img> on purpose: coverImage is an arbitrary external URL
              // and the Next image optimizer would need the *server* to fetch
              // it, which breaks on air-gapped or bandwidth-capped self-hosted
              // deploys. fetchPriority + an explicit aspect ratio get the LCP
              // and CLS wins without a server-side dependency.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={meta.coverImage}
                alt={coverAlt}
                width={1200}
                height={675}
                fetchPriority="high"
                decoding="async"
                className="mt-6 aspect-[16/9] w-full rounded-2xl border border-line object-cover"
              />
            )}
          </header>

          {/* Direct answer: the definition-block pattern AI citability scorers
              reward most, and the speakable target in the JSON-LD. */}
          {answer && (
            <section
              aria-label="Summary"
              className="post-answer mb-10 rounded-2xl border border-line border-l-4 border-l-brand bg-surface p-5"
            >
              {meta.answer.trim() !== meta.excerpt.trim() && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  In short
                </p>
              )}
              <ProseHtml
                html={answer}
                className="text-[1.02rem] leading-7 text-ink"
              />
            </section>
          )}

          {meta.takeaways.some((t) => t.trim()) && (
            <section
              aria-labelledby="takeaways-heading"
              className="mb-10 rounded-2xl border border-line bg-surface-soft/50 p-5"
            >
              <h2
                id="takeaways-heading"
                className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted"
              >
                Key takeaways
              </h2>
              <div className="text-[1rem] leading-7 text-ink [&_ul]:my-0 [&_li]:my-1">
                {takeawaysHtml.map((html, i) => (
                  <ProseHtml key={i} html={html} className="contents" />
                ))}
              </div>
            </section>
          )}

          <ProseHtml html={bodyHtml} className="text-[1.05rem] leading-8" />

          <Sources sources={meta.sources} />

          {/* FAQ rendered from frontmatter (schema is injected via JSON-LD) */}
          {faqItems.length > 0 && (
            <section
              aria-label="Frequently asked questions"
              className="post-faq mt-12"
            >
              <h2 className="font-serif text-2xl font-semibold text-ink">
                Frequently asked questions
              </h2>
              <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {faqItems.map((item, i) => (
                  <details key={i} className="group px-5 py-4" open={i === 0}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                      {item.question}
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    {item.answer && (
                      <ProseHtml html={faqAnswers[i]} className="mt-3 text-[0.95rem]" />
                    )}
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Structured data (escaped so post fields can't break out of the script tag) */}
          <JsonLd graph={graph} />
        </article>

        {showToc && (
          <aside className="mt-10 hidden lg:block">
            <div className="sticky top-24">
              <Toc items={toc} />
            </div>
          </aside>
        )}
      </div>

      {/* Internal linking: the crawl graph needs post-to-post edges, otherwise
          anything past the first page of the index is orphaned. */}
      {(newer || older || related.length > 0) && (
        <div className="mx-auto mt-16 w-full max-w-5xl border-t border-line pt-8">
          {(newer || older) && (
            <nav
              aria-label="Post navigation"
              className="grid gap-3 sm:grid-cols-2"
            >
              {older ? (
                <Link
                  href={`/blog/${older.slug}`}
                  className="group rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  <span className="text-xs uppercase tracking-wider text-ink-muted">
                    Older
                  </span>
                  <span className="mt-1 block font-serif font-semibold text-ink group-hover:text-brand">
                    {older.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {newer && (
                <Link
                  href={`/blog/${newer.slug}`}
                  className="group rounded-2xl border border-line bg-surface p-4 text-right transition-colors hover:border-line-strong"
                >
                  <span className="text-xs uppercase tracking-wider text-ink-muted">
                    Newer
                  </span>
                  <span className="mt-1 block font-serif font-semibold text-ink group-hover:text-brand">
                    {newer.title}
                  </span>
                </Link>
              )}
            </nav>
          )}

          {related.length > 0 && (
            <section aria-labelledby="related-heading" className="mt-10">
              <h2
                id="related-heading"
                className="font-serif text-xl font-semibold text-ink"
              >
                Related posts
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {related.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                  >
                    <span className="block font-medium leading-snug text-ink group-hover:text-brand">
                      {post.title}
                    </span>
                    <span className="mt-2 block text-xs text-ink-muted">
                      {formatDate(post.date)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
