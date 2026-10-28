import { NextRequest } from "next/server";
import { getAnalyticsProvider } from "@/lib/analytics/provider";
import { cspAllowsTracker, trackerOriginOf } from "@/lib/analytics/resolve";
import { jsonResponse, loadAnalyticsContext, requireAdmin } from "../_shared";

export const dynamic = "force-dynamic";

/**
 * Integration health: what is configured, what the provider says, and whether
 * the browser will even be allowed to reach the tracker.
 *
 * `tracking` and `reporting` are reported separately on purpose. "Collecting
 * traffic but cannot read reports" is a different fix (add the API key) from
 * "not configured at all", and collapsing them into one boolean sends the
 * author looking in the wrong place.
 *
 * No credential is ever returned — only whether one is present.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { resolved, timezone } = await loadAnalyticsContext();
  const provider = getAnalyticsProvider(resolved);
  const health = provider ? await provider.healthCheck() : null;

  return jsonResponse({
    configured: resolved.reporting,
    tracking: resolved.tracking,
    reporting: resolved.reporting,
    provider: resolved.provider,
    missing: resolved.missing,
    timezone,
    // Public settings only. The key itself never appears here.
    apiBase: resolved.apiBase,
    trackerOrigin: trackerOriginOf(resolved),
    cspAllowsTracker: cspAllowsTracker(resolved, process.env),
    health,
  });
}
