import Link from "next/link";
import { getSiteConfig } from "@/lib/site-config";

export async function Footer() {
  const config = await getSiteConfig();
  const year = new Date().getFullYear();

  const socials = [
    { key: "github", label: "GitHub", href: config.social.github },
    { key: "twitter", label: "Twitter", href: config.social.twitter },
    { key: "linkedin", label: "LinkedIn", href: config.social.linkedin },
  ].filter((s) => s.href);

  return (
    <footer className="border-t border-line bg-surface-soft/50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <p className="font-serif text-lg font-semibold text-ink">{config.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {config.description}
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Explore
          </span>
          <Link href="/" className="text-ink-muted transition-colors hover:text-brand">
            Home
          </Link>
          <Link href="/tags" className="text-ink-muted transition-colors hover:text-brand">
            Tags
          </Link>
          <a href="/rss.xml" className="text-ink-muted transition-colors hover:text-brand">
            RSS feed
          </a>
          <a href="/llms.txt" className="text-ink-muted transition-colors hover:text-brand">
            llms.txt
          </a>
        </nav>

        {socials.length > 0 && (
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Elsewhere
            </span>
            {socials.map((s) => (
              <a
                key={s.key}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-muted transition-colors hover:text-brand"
              >
                {s.label}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line py-4">
        <p className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 text-xs text-ink-muted sm:px-6">
          <span>
            © {year} {config.title}. Written in Markdown, served with care.
          </span>
          <span className="flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-brand"
            >
              Powered by Ansora
            </a>
            <Link href="/admin" className="transition-colors hover:text-brand">
              Admin
            </Link>
          </span>
        </p>
      </div>
    </footer>
  );
}
