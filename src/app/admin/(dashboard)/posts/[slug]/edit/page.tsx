import { notFound } from "next/navigation";
import { PostEditor } from "@/components/admin/PostEditor";
import { getAdapter } from "@/lib/content";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, config] = await Promise.all([
    getAdapter().getPost(slug),
    getSiteConfig(),
  ]);
  if (!post) notFound();

  return <PostEditor post={post} config={config} />;
}
