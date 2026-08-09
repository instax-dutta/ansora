/**
 * End-to-end test for the Appearance settings flow:
 *
 *   1. Save a theme through the REAL PUT /api/admin/settings handler
 *      (real zod validation + real JWT session; only the adapter and the
 *      cookie store are mocked — matching the other admin API route tests).
 *   2. Render the REAL root layout (next/font + site-config mocked) and
 *      assert the CSS custom properties it injects match the saved theme:
 *      accent, derived shades, radius scale, and heading font.
 *
 * The layout reads the site config through the same mocked adapter the API
 * wrote to, so a saved theme genuinely flows API → config → render → CSS.
 */
import { createElement } from "react";
import { renderToReadableStream } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken } from "@/lib/auth/session";
import { THEME_PRESETS } from "@/lib/theme";
import RootLayout from "@/app/layout";
import { PUT as putSettings } from "./route";

const h = vi.hoisted(() => {
  // In-memory "content repo": the API writes parsed config here and the
  // layout reads it back through the same adapter.
  const config: Record<string, unknown> = {};
  const adapter = {
    mode: "self-hosted" as const,
    listPosts: vi.fn(async () => []),
    getPost: vi.fn(async () => null),
    savePost: vi.fn(async () => {}),
    deletePost: vi.fn(async () => {}),
    getSiteConfig: vi.fn(async () => config),
    saveSiteConfig: vi.fn(async (c: Record<string, unknown>) => {
      for (const key of Object.keys(config)) delete config[key];
      Object.assign(config, c);
    }),
  };
  return { adapter, config, token: "", cookieName: "ansora_session" };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === h.cookieName && h.token ? { name, value: h.token } : undefined,
  })),
}));

vi.mock("@/lib/content", () => ({
  getAdapter: vi.fn(() => h.adapter),
}));

// The layout reads the site config through the same adapter the API wrote
// to, so the saved theme flows into the render — end to end. (The real
// site-config module keeps a 30s module cache that would leak between tests.)
vi.mock("@/lib/site-config", () => ({
  getSiteConfig: vi.fn(async () => h.adapter.getSiteConfig()),
}));

// next/font/google only exists inside the Next build — substitute the
// variable names the layout concatenates onto the <html> className.
vi.mock("next/font/google", () => ({
  Figtree: () => ({ variable: "--font-figtree", className: "" }),
  Fraunces: () => ({ variable: "--font-fraunces", className: "" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono", className: "" }),
}));

// 48 chars — passes the >= 32 requirement.
const SECRET = "test-jwt-secret-0123456789abcdef0123456789abcdef";

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", SECRET);
  h.token = "";
  for (const key of Object.keys(h.config)) delete h.config[key];
  h.adapter.saveSiteConfig.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function jsonRequest(path: string, method: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Mint a real, verifiable session token into the mocked cookie store. */
async function authed() {
  h.token = await createSessionToken();
}

/** Render the real root layout to HTML and return the markup. */
async function renderRootLayout(): Promise<string> {
  const stream = await renderToReadableStream(
    createElement(RootLayout, null, createElement("div"))
  );
  return new Response(stream as ReadableStream<Uint8Array>).text();
}

describe("Appearance settings — API save → root layout render", () => {
  it("saves a custom theme through the API", async () => {
    await authed();
    const res = await putSettings(
      jsonRequest("/api/admin/settings", "PUT", {
        theme: {
          preset: "ocean",
          accent: "#0f6d86",
          radius: "rounded",
          headingFont: "sans",
        },
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true });
    expect(h.adapter.saveSiteConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ansora", // untouched fields keep their schema defaults
        theme: {
          preset: "ocean",
          accent: "#0f6d86",
          radius: "rounded",
          headingFont: "sans",
        },
      })
    );
  });

  it("rejects an unknown preset", async () => {
    await authed();
    const res = await putSettings(
      jsonRequest("/api/admin/settings", "PUT", { theme: { preset: "neon" } })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: /Invalid settings/ });
  });

  it("rejects a non-string accent", async () => {
    await authed();
    const res = await putSettings(
      jsonRequest("/api/admin/settings", "PUT", { theme: { accent: 123 } })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: /Invalid settings/ });
  });

  it("renders the root layout with the saved theme's CSS variables", async () => {
    await authed();
    await putSettings(
      jsonRequest("/api/admin/settings", "PUT", {
        theme: {
          preset: "ocean",
          accent: "#0f6d86",
          radius: "rounded",
          headingFont: "sans",
        },
      })
    );

    const html = await renderRootLayout();

    // The injected <style> carries the live tokens: custom accent…
    expect(html).toContain("<style>");
    expect(html).toContain("html:root{");
    expect(html).toContain("--brand:#0f6d86");
    // Precomputed: mix("#0f6d86", "#000000", 0.22) → #0c5569
    expect(html).toContain("--brand-strong:#0c5569");
    // Precomputed: mix("#0f6d86", "#ffffff", 0.82) → #d4e5e9
    expect(html).toContain("--brand-soft:#d4e5e9");
    // …the ocean preset's paper in light mode…
    expect(html).toContain(`--paper:${THEME_PRESETS.ocean.light.paper}`);
    // …a dark-mode block with the ocean dark palette…
    expect(html).toContain("html.dark{");
    expect(html).toContain(`--paper:${THEME_PRESETS.ocean.dark.paper}`);
    // …the rounded radius scale…
    expect(html).toContain("--radius-2xl:1.5rem");
    // …and sans headings.
    expect(html).toContain("--font-serif:var(--font-figtree)");
  });

  it("renders the ocean preset's own colors when no accent override is set", async () => {
    await authed();
    await putSettings(
      jsonRequest("/api/admin/settings", "PUT", {
        theme: { preset: "ocean", accent: "" },
      })
    );

    const html = await renderRootLayout();

    // No custom accent → resolveTheme returns the preset's palette directly.
    expect(html).toContain(`--brand:${THEME_PRESETS.ocean.light.brand}`);
    expect(html).toContain(`--brand-strong:${THEME_PRESETS.ocean.light.brandStrong}`);
    expect(html).toContain(`--brand-soft:${THEME_PRESETS.ocean.light.brandSoft}`);
    expect(html).toContain(`--paper:${THEME_PRESETS.ocean.light.paper}`);
  });

  it("renders the midnight preset's dark mood with gold accent", async () => {
    await authed();
    await putSettings(
      jsonRequest("/api/admin/settings", "PUT", {
        theme: {
          preset: "midnight",
          accent: "#d4a017",
          radius: "sharp",
          headingFont: "sans",
        },
      })
    );

    const html = await renderRootLayout();

    // Preset's dark paper…
    expect(html).toContain(`--paper:${THEME_PRESETS.midnight.dark.paper}`);
    expect(html).toContain(`--surface:${THEME_PRESETS.midnight.dark.surface}`);
    // …custom gold accent…
    expect(html).toContain("--brand:#d4a017");
    // …sharp radius (the smallest scale)…
    expect(html).toContain("--radius-2xl:0.5rem");
    // …and sans headings.
    expect(html).toContain("--font-serif:var(--font-figtree)");
  });

  it("renders the warm defaults when no theme was ever saved", async () => {
    await authed();
    await putSettings(jsonRequest("/api/admin/settings", "PUT", {}));

    const html = await renderRootLayout();

    expect(html).toContain("html:root{");
    expect(html).toContain(`--brand:${THEME_PRESETS.warm.light.brand}`);
    expect(html).toContain(`--paper:${THEME_PRESETS.warm.light.paper}`);
    expect(html).toContain("--font-serif:var(--font-fraunces)");
    expect(html).toContain("--radius-2xl:1rem"); // "soft" is the default scale
  });
});
