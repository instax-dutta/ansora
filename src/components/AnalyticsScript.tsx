import { trackerConfigFor } from "@/lib/analytics/privacy";
import type { ResolvedAnalytics } from "@/lib/analytics/resolve";

/**
 * The optional public tracker.
 *
 * Rules this component exists to keep:
 * - **Disabled means silent.** No tag, no request, no preconnect, nothing.
 *   Returning `null` is the whole feature when analytics is off.
 * - **One deferred request.** A plain `async` tag is asynchronous by definition
 *   and adds no runtime to the reading experience — no queue, no wrapper.
 * - **Public surface only.** It is mounted by `(public)/layout.tsx`, so
 *   `/admin`, `/api` and the `/md` mirror can never load it; `isTrackablePath`
 *   encodes the same rule for anything that needs to ask in code.
 * - **The query string is not collected.** `data-exclude-search="true"` keeps
 *   UTM values and any accidentally-shared token out of the analytics store.
 */
export function AnalyticsScript({ resolved }: { resolved: ResolvedAnalytics }) {
  const tracker = trackerConfigFor(resolved);
  if (!tracker) return null;

  return (
    <script
      async
      defer
      src={tracker.src}
      data-website-id={tracker.websiteId}
      data-exclude-search="true"
    />
  );
}
