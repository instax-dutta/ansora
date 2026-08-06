import Link from "next/link";
import type { PostMeta } from "@/lib/content/types";
import { formatDate } from "@/lib/utils";

export function PostCard({ post }: { post: PostMeta }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_10px_36px_-12px_rgba(79,51,20,0.25)] dark:hover:shadow-[0_10px_36px_-12px_rgba(0,0,0,0.8)]">
      {post.coverImage ? (
        <Link
          href={`/blog/${post.slug}`}
          tabIndex={-1}
          className="block aspect-[16/9] w-full overflow-hidden"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImage}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        </Link>
      ) : (
        <div className="aspect-[16/9] w-full bg-brand-soft/60" aria-hidden="true">
          <div className="flex h-full items-center justify-center font-serif text-2xl font-semibold text-brand/50">
            {post.title.slice(0, 1).toUpperCase() || "A"}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <time
          dateTime={post.date}
          className="text-xs font-medium uppercase tracking-wider text-ink-muted"
        >
          {formatDate(post.date)}
        </time>

        <h2 className="font-serif text-xl font-semibold leading-snug text-ink">
          <Link
            href={`/blog/${post.slug}`}
            className="rounded-sm transition-colors hover:text-brand"
          >
            {post.title}
          </Link>
        </h2>

        {post.excerpt && (
          <p className="line-clamp-3 text-sm leading-relaxed text-ink-muted">
            {post.excerpt}
          </p>
        )}

        {post.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
            {post.tags.slice(0, 4).map((tag) => (
              <Link
                key={tag}
                href={`/tags/${tag}`}
                className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-strong transition-colors hover:bg-brand-200 dark:hover:bg-brand-900"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
