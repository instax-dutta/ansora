import { NextRequest } from "next/server";
import { z } from "zod";
import { clearAnalyticsCache } from "@/lib/analytics/cache";
import { cspAllowsTracker, resolveAnalyticsConfig, trackerOriginOf } from "@/lib/analytics/resolve";
import { getAdapter } from "@/lib/content";
import { analyticsConfigSchema } from "@/lib/content/types";
import { invalidateSiteConfig } from "@/lib/site-config";
import { jsonResponse, requireAdmin } from "../_shared";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({ analytics: analyticsConfigSchema });

/**
 * Save the analytics settings.
 *
 * Only the analytics block is writable here, and only public values: the API
 * key stays in `ANALYTICS_API_KEY`. Merging into the existing config (rather
 * than replacing it) means this route cannot clobber the author's title,
 * theme or base URL if a stale form is submitted.
 */
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: "Invalid analytics settings. Check the provider and URLs." },
      400
    );
  }

  try {
    const adapter = getAdapter();
    const current = await adapter.getSiteConfig();
    const next = { ...current, analytics: parsed.data.analytics };
    await adapter.saveSiteConfig(next);

    // New settings must be visible immediately: the config and report caches
    // are per-instance and would otherwise serve the previous integration's
    // numbers for up to their TTL.
    invalidateSiteConfig();
    clearAnalyticsCache();

    const resolved = resolveAnalyticsConfig(next);
    return jsonResponse({
      ok: true,
      analytics: {
        provider: resolved.provider,
        enabled: resolved.enabled,
        websiteId: resolved.websiteId,
        baseUrl: resolved.baseUrl,
        reportBaseUrl: parsed.data.analytics.reportBaseUrl,
        tracking: resolved.tracking,
        reporting: resolved.reporting,
        missing: resolved.missing,
        scriptUrl: resolved.scriptUrl,
        apiBase: resolved.apiBase,
        trackerOrigin: trackerOriginOf(resolved),
        cspAllowsTracker: cspAllowsTracker(resolved, process.env),
      },
    });
  } catch (err) {
    console.error("[analytics] saving settings failed:", err);
    return jsonResponse({ error: "Could not save the analytics settings." }, 500);
  }
}
