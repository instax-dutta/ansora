import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { aboutUrl, buildAboutGraph } from "@/lib/seo/jsonld";
import { withFeeds } from "@/lib/seo/metadata";
import { getSiteConfig } from "@/lib/site-config";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const title = `About ${config.author}`;
  return {
    title,
    description:
      config.authorBio || `${config.author}, the author behind ${config.title}.`,
    alternates: withFeeds(config, aboutUrl(config)),
    openGraph: {
      title,
      description:
        config.authorBio || `${config.author}, the author behind ${config.title}.`,
      url: aboutUrl(config),
    },
  };
}

/**
 * The author's entity home.
 *
 * Every post's JSON-LD references the author by `@id` pointing here. An entity
 * that resolves to a described page with `sameAs` profiles is a materially
 * stronger citation signal for AI engines than a bare name in a JSON-LD field.
 * Content is driven entirely by site config, so there is nothing to migrate.
 */
export default async function AboutPage() {
  const config = await getSiteConfig();
  const graph = buildAboutGraph(config);

  const links = [
    { label: "GitHub", href: config.social.github },
    { label: "Twitter", href: config.social.twitter },
    { label: "LinkedIn", href: config.social.linkedin },
  ].filter((l) => l.href);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd graph={graph} />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-muted">
        <Link href="/" className="transition-colors hover:text-brand">
          {config.title}
        </Link>
        <span aria-hidden="true" className="mx-1.5">
          /
        </span>
        <span className="text-ink">About</span>
      </nav>

      <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {config.author}
      </h1>
      {config.authorRole && (
        <p className="mt-2 text-lg text-ink-muted">{config.authorRole}</p>
      )}

      <div className="mt-8 space-y-4 text-[1.05rem] leading-8 text-ink">
        {config.authorBio ? (
          <p>{config.authorBio}</p>
        ) : (
          <p>
            {config.author} writes at {config.title}.{" "}
            {config.description}
          </p>
        )}
      </div>

      {links.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Elsewhere
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:text-brand"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 border-t border-line pt-6 text-sm text-ink-muted">
        <p>
          Every post is a markdown file committed to git.{" "}
          <a href="/rss.xml" className="text-brand hover:underline">
            RSS
          </a>
          ,{" "}
          <a href="/llms.txt" className="text-brand hover:underline">
            llms.txt
          </a>{" "}
          or{" "}
          <a href="/feed.json" className="text-brand hover:underline">
            the JSON feed
          </a>{" "}
          to follow along.
        </p>
      </div>
    </div>
  );
}
