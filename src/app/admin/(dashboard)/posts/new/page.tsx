import { PostEditor } from "@/components/admin/PostEditor";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  // The editor needs the site config for the live SERP/social previews.
  const config = await getSiteConfig();
  return <PostEditor post={null} config={config} />;
}
