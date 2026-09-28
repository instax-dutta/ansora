import Link from "next/link";
import { tagSlug } from "@/lib/utils";

/**
 * Tag links always point at the normalized `/tags/<slug>` form. Tags are stored
 * and displayed verbatim, so a tag like "Search Engine Optimization" renders
 * with its original text but links to a stable lowercase URL. Already-safe tags
 * map to themselves, so existing tag URLs are untouched.
 */
export function TagLinks({
  tags,
  className,
}: {
  tags: string[];
  className?: string;
}) {
  if (tags.length === 0) return null;
  return (
    <div className={className}>
      {tags.map((tag) => (
        <Link
          key={tag}
          href={`/tags/${tagSlug(tag)}`}
          className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-strong transition-colors hover:bg-brand/15 dark:hover:bg-brand/25"
        >
          {tag}
        </Link>
      ))}
    </div>
  );
}
