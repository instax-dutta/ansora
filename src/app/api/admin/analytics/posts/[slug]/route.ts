import { NextRequest } from "next/server";
import { analyticsCacheKey, cachedAnalytics } from "@/lib/analytics/cache";
import { toAnalyticsError } from "@/lib/analytics/errors";
import { buildOpportunitiesForPost } from "@/lib/analytics/opportunities";
import { getAnalyticsProvider } from "@/lib/analytics/provider";
import { isIndexable } from "@/lib/seo/publish";
import { getAdapter } from "@/lib/content";
import { isSafeSlug } from "@/lib/content/slug";
import { readingTimeMinutes } from "@/lib/utils";
import {
  jsonResponse,
  loadAnalyticsContext,
  loadPostsForMapping,
  parseQuery,
  requireAdmin,
  setupState,
} from "../../_shared";

export const dynamic = "force-dynamic";

/**
 * One post's performance, plus the content context that makes it actionable.
 *
 * Drafts 404 here exactly as they do on the public site. Analytics is not a
 * back door: a slug that is not published must not be confirmable, let alone
 * have its title and traffic displayed.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { slug } = await context.params;
  if (!isSafeSlug(slug)) {
    return jsonResponse({ error: "Not found." }, 404);
  }

  const { config, resolved, timezone } = await loadAnalyticsContext();
  const parsed = parseQuery(request, timezone);
  if (!parsed.ok) return parsed.response;
  const query = parsed.query;

  const posts = await loadPostsForMapping();
  const post = posts.find((entry) => entry.slug === slug && entry.published);
  if (!post) {
    return jsonResponse({ error: "Not found." }, 404);
  }

  const path = `/blog/${post.slug}`;
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const contextPayload = {
    slug: post.slug,
    title: post.title || post.slug,
    published: post.published,
    noIndex: post.seo.noIndex,
    indexable: isIndexable(post),
    tags: post.tags,
    date: post.date,
    updated: post.updated ?? null,
    updatedReason: post.updatedReason,
    url: `${baseUrl}${path}`,
    editHref: `/admin/posts/${encodeURIComponent(post.slug)}/edit`,
    readingMinutes: await readingMinutesFor(slug),
  };

  if (!resolved.reporting) {
    return jsonResponse({
      ...setupState(resolved, timezone),
      query,
      path,
      post: contextPayload,
      performance: null,
      opportunities: [],
      degraded: null,
    });
  }

  const provider = getAnalyticsProvider(resolved);
  if (!provider) {
    return jsonResponse({
      ...setupState(resolved, timezone),
      query,
      path,
      post: contextPayload,
      performance: null,
      opportunities: [],
      degraded: { code: "unconfigured", message: "No analytics provider is available." },
    });
  }

  const key = analyticsCacheKey({
    kind: "post",
    provider: resolved.provider,
    websiteId: resolved.websiteId,
    path,
    from: query.from,
    to: query.to,
    timezone: query.timezone,
    granularity: query.granularity,
    compare: query.compareToPreviousPeriod,
  });

  try {
    const performance = await cachedAnalytics(key, () =>
      provider.getPagePerformance(path, query)
    );
    return jsonResponse({
      configured: true,
      tracking: resolved.tracking,
      reporting: true,
      provider: resolved.provider,
      missing: resolved.missing,
      timezone,
      query,
      path,
      post: contextPayload,
      performance,
      opportunities: buildOpportunitiesForPost({ post, performance }),
      degraded: null,
    });
  } catch (err) {
    const failure = toAnalyticsError(err);
    console.warn(`[analytics] post report unavailable (${failure.code}): ${failure.message}`);
    return jsonResponse({
      configured: true,
      tracking: resolved.tracking,
      reporting: true,
      provider: resolved.provider,
      missing: resolved.missing,
      timezone,
      query,
      path,
      post: contextPayload,
      performance: null,
      // No performance data means no recommendation: a provider outage is not
      // evidence that this post has no readers.
      opportunities: [],
      degraded: failure.toFailure(),
    });
  }
}

/**
 * Estimated reading time.
 *
 * Reads one body — never a loop — and degrades to null if the content store is
 * unhappy. It is labelled "estimated" in the UI because it is a word count, not
 * measured attention.
 */
async function readingMinutesFor(slug: string): Promise<number | null> {
  try {
    const post = await getAdapter().getPost(slug);
    if (!post) return null;
    return readingTimeMinutes(post.content);
  } catch {
    return null;
  }
}
