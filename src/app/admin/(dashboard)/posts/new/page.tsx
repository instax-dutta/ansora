import { PostEditor } from "@/components/admin/PostEditor";
import { getAdapter, safeListPosts } from "@/lib/content";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  // The editor needs the site config for the live SERP/social previews, and the
  // published set for the cross-post cannibalization check.
  const [config, siblings] = await Promise.all([
    getSiteConfig(),
    getAdapter()
      .listPosts()
      .catch(() => safeListPosts()),
  ]);
  return (
    <PostEditor
      post={null}
      config={config}
      siblingPosts={siblings.filter((p) => p.published)}
    />
  );
}
