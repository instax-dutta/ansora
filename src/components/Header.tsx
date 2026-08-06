import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { getSiteConfig } from "@/lib/site-config";

export async function Header() {
  const config = await getSiteConfig();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-serif text-lg font-bold text-on-brand transition-transform group-hover:scale-105">
            A
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight text-ink">
            {config.title}
          </span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
          >
            Home
          </Link>
          <Link
            href="/tags"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
          >
            Tags
          </Link>
          <a
            href="/rss.xml"
            title="RSS feed"
            aria-label="RSS feed"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:border-line-strong hover:text-brand"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M6.5 17.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM4 10.5a9.5 9.5 0 0 1 9.5 9.5H10a6 6 0 0 0-6-6v-3.5Zm0-6.5A16 16 0 0 1 20 20h-3.5A12.5 12.5 0 0 0 4 7.5V4Z" />
            </svg>
          </a>
          <ThemeToggle />
          <Link
            href="/admin"
            className="ml-1 hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink sm:block"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
