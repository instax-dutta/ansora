import Link from "next/link";
import { getAdapter } from "@/lib/content";
import { getSiteConfig } from "@/lib/site-config";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const adapter = getAdapter();
  const [posts, config] = await Promise.all([
    adapter.listPosts(),
    getSiteConfig(),
  ]);

  const published = posts.filter((p) => p.published).length;
  const drafts = posts.length - published;
  const recent = [...posts]
    .sort((a, b) => (b.updated || b.date).localeCompare(a.updated || a.date))
    .slice(0, 6);

  const stats = [
    { label: "Total posts", value: posts.length },
    { label: "Published", value: published },
    { label: "Drafts", value: drafts },
  ];

  const modeDetail =
    adapter.mode === "self-hosted"
      ? `Local files · ${process.env.CONTENT_DIR || "content/"}`
      : `GitHub · ${process.env.GITHUB_REPO}@${process.env.GITHUB_BRANCH || "main"}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Welcome back to {config.title}. Every save is a git commit.
          </p>
        </div>
        <Link
          href="/admin/posts/new"
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong"
        >
          + New post
        </Link>
      </div>

      {/* Stats */}
      <section aria-label="Post statistics" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm text-ink-muted">{stat.label}</p>
            <p className="mt-1 font-serif text-4xl font-semibold text-ink">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Recent activity */}
        <section aria-label="Recent activity" className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-ink">Recent activity</h2>
            <Link href="/admin/posts" className="text-sm font-medium text-brand hover:underline">
              All posts
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">
              No posts yet —{" "}
              <Link href="/admin/posts/new" className="text-brand hover:underline">
                write your first one
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {recent.map((post) => (
                <li key={post.slug}>
                  <Link
                    href={`/admin/posts/${encodeURIComponent(post.slug)}/edit`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface-soft/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {post.title || <span className="italic text-ink-muted">Untitled</span>}
                      </span>
                      <span className="block font-mono text-xs text-ink-muted">
                        /{post.slug}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      <time dateTime={post.updated || post.date} className="text-ink-muted">
                        {formatDate(post.updated || post.date)}
                      </time>
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          post.published
                            ? "bg-brand-soft text-brand-strong"
                            : "bg-surface-soft text-ink-muted"
                        }`}
                      >
                        {post.published ? "Published" : "Draft"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Side column */}
        <div className="space-y-6">
          <section aria-label="Quick actions" className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-serif text-lg font-semibold text-ink">Quick actions</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                { href: "/admin/posts/new", label: "Write a new post" },
                { href: "/admin/posts", label: "Manage posts" },
                { href: "/admin/settings", label: "Site settings" },
                { href: "/", label: "View public site", external: true },
              ].map((action) => (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    target={action.external ? "_blank" : undefined}
                    rel={action.external ? "noopener noreferrer" : undefined}
                    className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 font-medium text-ink transition-colors hover:border-line-strong hover:text-brand"
                  >
                    {action.label}
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 17 17 7M8 7h9v9" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Deployment info" className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-serif text-lg font-semibold text-ink">Storage</h2>
            <p className="mt-2 text-sm text-ink-muted">{modeDetail}</p>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              {adapter.mode === "self-hosted"
                ? "Changes are committed to git instantly and visible on the public site immediately."
                : "Every save commits to GitHub; the public site refreshes after the deploy hook rebuilds."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
