/**
 * Bounded-concurrency mapping.
 *
 * Sequential `for … await` over N remote calls costs N round-trip latencies.
 * Firing all N at once is faster still but is a bad neighbour: it exhausts
 * sockets, trips provider rate limits, and gives a burst no way to back off.
 *
 * This is the middle ground, and it is deliberately its own tested module
 * because getting the ordering and error semantics right is the whole point.
 */

/** Default cap. 8 keeps latency low without hammering an API. */
export const DEFAULT_CONCURRENCY = 8;

/**
 * Run `worker` over every item with at most `limit` in flight, preserving
 * **input order** in the output.
 *
 * `worker` receives the item and its index. If it throws, that slot becomes
 * `undefined` and the rest still run — one bad post must not blank the whole
 * listing.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  if (items.length === 0) return results;

  const width = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  let cursor = 0;

  async function run(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch {
        // Leave the slot undefined; callers decide what a missing entry means.
      }
    }
  }

  await Promise.all(Array.from({ length: width }, run));
  return results;
}
