import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("preserves input order in the output", async () => {
    // Concurrency scrambles completion order; the result must not.
    const items = [30, 5, 20, 1, 15, 2];
    const out = await mapWithConcurrency(items, 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms * 2;
    });
    expect(out).toEqual([60, 10, 40, 2, 30, 4]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 40 }, (_, i) => i), 4, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return null;
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it("is faster than sequential on latency-bound work", async () => {
    const items = Array.from({ length: 12 }, (_, index) => index);
    const work = async () => {
      await new Promise((r) => setTimeout(r, 20));
    };
    const seqStart = Date.now();
    for (let i = 0; i < items.length; i++) await work();
    const seq = Date.now() - seqStart;

    const parStart = Date.now();
    await mapWithConcurrency(items, 6, work);
    const par = Date.now() - parStart;

    // 12 x 20ms sequential is ~240ms; concurrent should be a fraction of that.
    expect(par).toBeLessThan(seq);
  });

  it("leaves a failed slot empty without dropping the rest", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(out[0]).toBe(1);
    expect(out[1]).toBeUndefined();
    expect(out[2]).toBe(3);
    expect(out[3]).toBe(4);
  });

  it("handles an empty list and a nonsensical limit", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 0, async (n) => n)).toEqual([1, 2]);
    expect(await mapWithConcurrency([1, 2], -5, async (n) => n)).toEqual([1, 2]);
  });

  it("never launches more workers than there are items", async () => {
    let peak = 0;
    let inFlight = 0;
    await mapWithConcurrency([1, 2], 50, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return n;
    });
    expect(peak).toBe(2);
  });
});
