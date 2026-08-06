import Link from "next/link";
import { PostsTable } from "@/components/admin/PostsTable";
import { getAdapter } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage() {
  const posts = await getAdapter().listPosts();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">Posts</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every edit is saved as a markdown file and committed to git.
          </p>
        </div>
        <Link
          href="/admin/posts/new"
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong"
        >
          + New post
        </Link>
      </div>

      <div className="mt-6">
        <PostsTable initialPosts={posts} />
      </div>
    </div>
  );
}
