import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL auto-cleanup relies on a global afterEach, which is off (no `globals: true`),
// so unmount every rendered tree after each test explicitly.
afterEach(() => {
  cleanup();
});

// jsdom with pretendToBeVisual provides requestAnimationFrame, but guard anyway
// so the editor tests never depend on the environment providing it.
if (typeof globalThis.requestAnimationFrame !== "function") {
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    writable: true,
    value: (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number,
  });
  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    writable: true,
    value: (id: number) => clearTimeout(id),
  });
}
