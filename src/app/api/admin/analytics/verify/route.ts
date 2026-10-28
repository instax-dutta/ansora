import { NextRequest } from "next/server";
import { clearAnalyticsCache } from "@/lib/analytics/cache";
import { AnalyticsError } from "@/lib/analytics/errors";
import { getAnalyticsProvider } from "@/lib/analytics/provider";
import { jsonResponse, loadAnalyticsContext, requireAdmin } from "../_shared";

export const dynamic = "force-dynamic";

/**
 * Explicit connection test.
 *
 * POST (and therefore origin-checked) because it is a deliberate action, and
 * because it bypasses the report cache: a "Test connection" button that returns
 * a cached success from two minutes ago would be worse than no button.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { resolved } = await loadAnalyticsContext();
  const provider = getAnalyticsProvider(resolved);

  if (!provider) {
    return jsonResponse({
      ok: false,
      error: new AnalyticsError(
        "unconfigured",
        "Add a provider, website ID, tracker URL and ANALYTICS_API_KEY before testing the connection."
      ).toFailure(),
      health: null,
    });
  }

  clearAnalyticsCache();
  const health = await provider.healthCheck();

  return jsonResponse({
    ok: health.ok,
    error: health.error,
    health,
  });
}
