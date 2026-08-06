import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProseHtml } from "@/components/ProseHtml";
import { Toc } from "@/components/Toc";
import { getAdapter } from "@/lib/content";
import { extractToc } from "@/lib/markdown/pipeline";
import { renderMarkdown } from "@/lib/markdown/render";
import { buildPostJsonLd, postUrl } from "@/lib/seo/jsonld";
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
    alternates: { canonical: meta.seo.canonicalUrl || url },
    robots: meta.seo.noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      url,
      publishedTime: meta.date,
      modifiedTime: meta.updated || meta.date,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, config] = await Promise.all([
    getAdapter().getPost(slug),
    getSiteConfig(),
  ]);
  // Unpublished posts are never served on the public site.
  if (!post || !post.meta.published) notFound();

  const { meta, content } = post;
  const [bodyHtml, toc] = await Promise.all([
    renderMarkdown(content),
    extractToc(content),
  ]);
  const faqItems = meta.faq.filter((f) => f.question);
  const faqAnswers = await Promise.all(
    faqItems.map((f) => renderMarkdown(f.answer))
  );
  const wordCount = countWords(content);
  const minutes = readingTimeMinutes(content);
  const showToc = wordCount > 800 && toc.length >= 2;
  const jsonLd = buildPostJsonLd(meta, config);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className={showToc ? "lg:grid lg:grid-cols-[minmax(0,1fr)_250px] lg:gap-10" : ""}>
        <article>
          {/* Post header */}
          <header className="mb-8">
            {meta.tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {meta.tags.map((tag) => (
                  <a
                    key={tag}
                    href={`/tags/${tag}`}
                    className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-strong transition-colors hover:bg-brand-200 dark:hover:bg-brand-900"
                  >
                    {tag}
                  </a>
                ))}
              </div>
            )}

            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
              {meta.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <span>{config.author}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={meta.date}>{formatDate(meta.date)}</time>
              {meta.updated && meta.updated !== meta.date && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Updated {formatDate(meta.updated)}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{minutes} min read</span>
            </div>

            {meta.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={meta.coverImage}
                alt=""
                className="mt-6 aspect-[16/9] w-full rounded-2xl border border-line object-cover"
              />
            )}
          </header>

          <ProseHtml html={bodyHtml} className="text-[1.05rem] leading-8" />

          {/* FAQ rendered from frontmatter (schema is injected via JSON-LD) */}
          {faqItems.length > 0 && (
            <section aria-label="Frequently asked questions" className="mt-12">
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

          {/* Structured data */}
          {jsonLd.map((graph, i) => (
            <script
              key={i}
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
            />
          ))}
        </article>

        {showToc && (
          <aside className="mt-10 hidden lg:block">
            <div className="sticky top-24">
              <Toc items={toc} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
