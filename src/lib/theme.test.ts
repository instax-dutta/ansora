import { describe, expect, it } from "vitest";
import {
  buildThemeCss,
  contrast,
  hexToRgb,
  luminance,
  mix,
  RADIUS_SCALES,
  resolveTheme,
  textOn,
  THEME_PRESETS,
} from "./theme";
import { DEFAULT_THEME_CONFIG } from "./content/types";

describe("color helpers", () => {
  it("parses hex colors", () => {
    expect(hexToRgb("#b04e14")).toEqual({ r: 176, g: 78, b: 20 });
    expect(hexToRgb("b04e14")).toEqual({ r: 176, g: 78, b: 20 });
    expect(hexToRgb("nope")).toBeNull();
    expect(hexToRgb("#fff")).toBeNull();
  });

  it("mixes toward a target color", () => {
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#ffffff", "#000000", 0.5)).toBe("#808080");
  });

  it("computes luminance, contrast and readable foreground", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBe(1);
    expect(contrast("#000000", "#ffffff")).toBeGreaterThanOrEqual(21);
    expect(textOn("#000000")).toBe("#fffaf4");
    expect(textOn("#ffffff")).toBe("#16130e");
    // Mid-tone accent (#666666, lum ≈ 0.13): white must win for AA-ish contrast.
    expect(contrast("#fffaf4", "#666666")).toBeGreaterThan(
      contrast("#16130e", "#666666")
    );
    expect(textOn("#666666")).toBe("#fffaf4");
  });
});

describe("presets", () => {
  it("defines all four presets with full light+dark palettes", () => {
    const ids = Object.keys(THEME_PRESETS);
    expect(ids.sort()).toEqual([
      "claude",
      "claude-dark",
      "forest",
      "midnight",
      "minimax",
      "minimax-dark",
      "ocean",
      "opencode",
      "opencode-dark",
      "warm",
    ]);
    for (const id of ids) {
      const preset = THEME_PRESETS[id as keyof typeof THEME_PRESETS];
      expect(Object.keys(preset.light)).toHaveLength(11);
      expect(Object.keys(preset.dark)).toHaveLength(11);
      for (const key of Object.keys(preset.light) as (keyof typeof preset.light)[]) {
        expect(preset.light[key]).toMatch(/^#[0-9a-f]{6}$/i);
        expect(preset.dark[key]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe("resolveTheme", () => {
  it("returns the preset palettes when no accent override is set", () => {
    const { light, dark } = resolveTheme({ ...DEFAULT_THEME_CONFIG, preset: "ocean" });
    expect(light.brand).toBe(THEME_PRESETS.ocean.light.brand);
    expect(dark.brand).toBe(THEME_PRESETS.ocean.dark.brand);
  });

  it("applies a custom accent and derives its variants", () => {
    const { light, dark } = resolveTheme({ ...DEFAULT_THEME_CONFIG, accent: "#123456" });
    expect(light.brand).toBe("#123456");
    expect(light.brandStrong).not.toBe(light.brand);
    expect(light.brandSoft).not.toBe(light.brand);
    expect(light.onBrand).toMatch(/^#[0-9a-f]{6}$/i);
    // Dark mode brightens the accent so it pops on a dark paper.
    expect(luminance(dark.brand)).toBeGreaterThan(luminance(light.brand));
  });

  it("ignores malformed accents", () => {
    const { light } = resolveTheme({ ...DEFAULT_THEME_CONFIG, accent: "hotpink" });
    expect(light.brand).toBe(THEME_PRESETS.warm.light.brand);
  });

  it("resolves the midnight preset without accent override", () => {
    const { light, dark } = resolveTheme({ ...DEFAULT_THEME_CONFIG, preset: "midnight" });
    expect(light.brand).toBe(THEME_PRESETS.midnight.light.brand);
    expect(dark.brand).toBe(THEME_PRESETS.midnight.dark.brand);
    expect(dark.paper).toBe("#0d0f17");
  });

  it("falls back to warm for unknown presets", () => {
    const { light } = resolveTheme({ ...DEFAULT_THEME_CONFIG, preset: "neon" as never });
    expect(light.paper).toBe(THEME_PRESETS.warm.light.paper);
  });
});

describe("buildThemeCss", () => {
  it("emits light and dark palette variables with winning selectors", () => {
    const css = buildThemeCss(DEFAULT_THEME_CONFIG);
    expect(css).toContain("html:root{");
    expect(css).toContain("html.dark{");
    expect(css).toContain("--paper:" + THEME_PRESETS.warm.light.paper);
    expect(css).toContain("--brand:" + THEME_PRESETS.warm.light.brand);
    expect(css).toContain("--paper:" + THEME_PRESETS.warm.dark.paper);
    expect(css).toContain("color-scheme:light");
    expect(css).toContain("color-scheme:dark");
  });

  it("maps the radius scale and heading font", () => {
    const soft = buildThemeCss({ ...DEFAULT_THEME_CONFIG, radius: "soft" });
    expect(soft).toContain("--radius-lg:" + RADIUS_SCALES.soft["--radius-lg"]);

    const rounded = buildThemeCss({ ...DEFAULT_THEME_CONFIG, radius: "rounded" });
    expect(rounded).toContain("--radius-2xl:" + RADIUS_SCALES.rounded["--radius-2xl"]);

    const serif = buildThemeCss({ ...DEFAULT_THEME_CONFIG, headingFont: "serif" });
    expect(serif).toContain("--font-serif:var(--font-fraunces)");

    const sans = buildThemeCss({ ...DEFAULT_THEME_CONFIG, headingFont: "sans" });
    expect(sans).toContain("--font-serif:var(--font-figtree)");
  });

  it("emits the accent override into both modes", () => {
    const css = buildThemeCss({ ...DEFAULT_THEME_CONFIG, accent: "#0f6d86" });
    expect(css).toContain("--brand:#0f6d86");
  });

  it("falls back to soft radius and serif headings for unknown values", () => {
    const css = buildThemeCss({
      ...DEFAULT_THEME_CONFIG,
      radius: "extreme" as never,
      headingFont: "comic" as never,
    });
    expect(css).toContain("--radius-lg:" + RADIUS_SCALES.soft["--radius-lg"]);
    expect(css).toContain("--font-serif:var(--font-fraunces)");
  });
});
