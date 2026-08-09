"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PostMeta } from "@/lib/content/types";
import { formatDate } from "@/lib/utils";

type StatusFilter = "all" | "published" | "draft";

export function PostsTable({ initialPosts }: { initialPosts: PostMeta[] }) {
  const [posts, setPosts] = useState<PostMeta[]>(initialPosts);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (status === "published" && !p.published) return false;
      if (status === "draft" && p.published) return false;
      if (tag !== "all" && !p.tags.includes(tag)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.slug.includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [posts, query, tag, status]);

  const togglePublish = async (post: PostMeta) => {
    setBusy(post.slug);
    setError("");
    try {
      const res = await fetch(`/api/admin/posts/${encodeURIComponent(post.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !post.published }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setPosts((prev) =>
        prev.map((p) =>
          p.slug === post.slug ? { ...p, published: !p.published } : p
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (post: PostMeta) => {
    if (!window.confirm(`Delete “${post.title || post.slug}”? This removes the file and commits the deletion.`)) {
      return;
    }
    setBusy(post.slug);
    setError("");
    try {
      const res = await fetch(`/api/admin/posts/${encodeURIComponent(post.slug)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setPosts((prev) => prev.filter((p) => p.slug !== post.slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="post-search" className="sr-only">
            Search posts
          </label>
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            id="post-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, slug, tag…"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/70 focus:border-brand"
          />
        </div>

        <div className="flex gap-2">
          <label htmlFor="tag-filter" className="sr-only">
            Filter by tag
          </label>
          <select
            id="tag-filter"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          >
            <option value="all">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div role="group" aria-label="Filter by status" className="flex overflow-hidden rounded-lg border border-line">
            {(["all", "published", "draft"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={`px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  status === s
                    ? "bg-brand-soft text-brand-strong"
                    : "bg-surface text-ink-muted hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand-strong">
          {error}
        </p>
      )}

      <p className="text-sm text-ink-muted" aria-live="polite">
        {filtered.length} of {posts.length} posts
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong p-12 text-center">
          <p className="text-ink">No posts match your filters.</p>
          <Link
            href="/admin/posts/new"
            className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
          >
            Write a new post
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-4 py-3 font-semibold">Title</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">Date</th>
                <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">Tags</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((post) => (
                <tr key={post.slug} className="transition-colors hover:bg-surface-soft/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/posts/${encodeURIComponent(post.slug)}/edit`}
                      className="font-medium text-ink transition-colors hover:text-brand"
                    >
                      {post.title || <span className="italic text-ink-muted">Untitled</span>}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-ink-muted">/{post.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        post.published
                          ? "bg-brand-soft text-brand-strong"
                          : "bg-surface-soft text-ink-muted"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          post.published ? "bg-brand" : "bg-ink-muted"
                        }`}
                        aria-hidden="true"
                      />
                      {post.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-ink-muted md:table-cell">
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {post.tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded-full bg-surface-soft px-2 py-0.5 text-xs text-ink-muted">
                          {t}
                        </span>
                      ))}
                      {post.tags.length > 3 && (
                        <span className="text-xs text-ink-muted">+{post.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => togglePublish(post)}
                        disabled={busy === post.slug}
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-line-strong hover:text-brand disabled:opacity-50"
                      >
                        {post.published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(post)}
                        disabled={busy === post.slug}
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
