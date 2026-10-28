/**
 * Analytics report cache.
 *
 * Its only job is to reduce provider API traffic, which is rate limited. That
 * makes it deliberately boring and per-instance: in serverless it may be cold,
 * and it is never treated as a source of truth. The `fetchedAt` on the payload
 * is what tells the author how old the numbers are.
 *
 * Three properties are load-bearing:
 * - the key includes every input that changes the answer (provider, site,
 *   range, timezone, granularity, report kind, filter) — mixing two sites in
 *   one entry would show one blog's traffic on another;
 * - concurrent callers for one key share a single provider request, because the
 *   dashboard fetches the overview and the table at the same time;
 * - a rejected load is never cached, so a transient outage cannot pin an error
 *   for the whole TTL.
 */

export const ANALYTICS_CACHE_TTL_MS = 120_000;

interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Deterministic key from every dimension that changes the result.
 *
 * Keys are sorted so two callers that assemble the same parts in a different
 * order share the entry instead of doubling the provider calls.
 */
export function analyticsCacheKey(
  parts: Record<string, string | number | boolean | undefined | null>
): string {
  const entries = Object.entries(parts)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`);
  return entries.join("&");
}

/** Memoised loader with a per-key TTL and single-flight de-duplication. */
export async function cachedAnalytics<T>(
  key: string,
  load: () => Promise<T>,
  options: { ttlMs?: number } = {}
): Promise<T> {
  const ttlMs = options.ttlMs ?? ANALYTICS_CACHE_TTL_MS;
  const now = Date.now();

  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  if (hit) store.delete(key);

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = load()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/** Test seam, and the hook a config change uses to stop serving stale numbers. */
export function clearAnalyticsCache(): void {
  store.clear();
  inFlight.clear();
}

/** Diagnostics for the health panel. */
export function analyticsCacheSize(): number {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  return store.size;
}
