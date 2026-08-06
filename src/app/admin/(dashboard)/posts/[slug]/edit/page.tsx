import { notFound } from "next/navigation";
import { PostEditor } from "@/components/admin/PostEditor";
import { getAdapter } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getAdapter().getPost(slug);
  if (!post) notFound();

  return <PostEditor post={post} />;
}
