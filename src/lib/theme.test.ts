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
  it("defines the curated voices with full light+dark palettes and a face", () => {
    const ids = Object.keys(THEME_PRESETS);
    expect(ids.sort()).toEqual([
      "atelier",
      "broadsheet",
      "console",
      "folio",
      "inkline",
      "lantern",
      "ledger",
      "nocturne",
    ]);
    for (const id of ids) {
      const preset = THEME_PRESETS[id as keyof typeof THEME_PRESETS];
      expect(Object.keys(preset.light)).toHaveLength(11);
      expect(Object.keys(preset.dark)).toHaveLength(11);
      for (const key of Object.keys(preset.light) as (keyof typeof preset.light)[]) {
        expect(preset.light[key]).toMatch(/^#[0-9a-f]{6}$/i);
        expect(preset.dark[key]).toMatch(/^#[0-9a-f]{6}$/i);
      }
      // The face is what makes the theme a material, not a palette chip.
      expect(preset.face.density).toMatch(/rem$/);
      expect(["sans", "serif"]).toContain(preset.face.bodyFont);
      expect(["sans", "mono"]).toContain(preset.face.chrome);
      expect(typeof preset.face.displayWeight).toBe("number");
    }
  });
});

describe("resolveTheme", () => {
  it("returns the preset palettes when no accent override is set", () => {
    const { light, dark } = resolveTheme({ ...DEFAULT_THEME_CONFIG, preset: "broadsheet" });
    expect(light.brand).toBe(THEME_PRESETS.broadsheet.light.brand);
    expect(dark.brand).toBe(THEME_PRESETS.broadsheet.dark.brand);
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
    expect(light.brand).toBe(THEME_PRESETS.inkline.light.brand);
  });

  it("resolves the nocturne preset without accent override", () => {
    const { light, dark } = resolveTheme({ ...DEFAULT_THEME_CONFIG, preset: "nocturne" });
    expect(light.brand).toBe(THEME_PRESETS.nocturne.light.brand);
    expect(dark.brand).toBe(THEME_PRESETS.nocturne.dark.brand);
    expect(dark.paper).toBe("#0a0c16");
  });

  it("falls back to the default voice for unknown presets", () => {
    const { light } = resolveTheme({ ...DEFAULT_THEME_CONFIG, preset: "neon" as never });
    expect(light.brand).toBe(THEME_PRESETS.inkline.light.brand);
  });
});

describe("buildThemeCss", () => {
  it("emits light and dark palette variables with winning selectors", () => {
    const css = buildThemeCss(DEFAULT_THEME_CONFIG);
    expect(css).toContain("html:root{");
    expect(css).toContain("html.dark{");
    expect(css).toContain("--paper:" + THEME_PRESETS.inkline.light.paper);
    expect(css).toContain("--brand:" + THEME_PRESETS.inkline.light.brand);
    expect(css).toContain("--paper:" + THEME_PRESETS.inkline.dark.paper);
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

  it("emits the face tokens a preset chooses", () => {
    // Broadsheet sets serif body, mono chrome, ruled strokes and a drop cap.
    const css = buildThemeCss({ ...DEFAULT_THEME_CONFIG, preset: "broadsheet" });
    expect(css).toContain("--face-density:0.235rem");
    expect(css).toContain("--face-body-font:var(--font-fraunces)");
    expect(css).toContain("--face-chrome-font:var(--font-geist-mono)");
    expect(css).toContain("--face-stroke-width:1.5px");
    expect(css).toContain("--face-dropcap-float:left");
    // Emitted on both selectors: the voice covers light and dark alike.
    expect(css.split("--face-density:0.235rem").length - 1).toBe(2);

    // Ledger keeps hairline solid strokes and no drop cap… but underlines.
    const ledger = buildThemeCss({ ...DEFAULT_THEME_CONFIG, preset: "ledger" });
    expect(ledger).toContain("--face-stroke-style:solid");
    expect(ledger).toContain("--face-dropcap-float:none");
  });

  it("carries a dark-only voice in both selectors", () => {
    const css = buildThemeCss({ ...DEFAULT_THEME_CONFIG, preset: "console" });
    const root = css.slice(0, css.indexOf("html.dark"));
    // The root (light) slot mirrors the dark palette…
    expect(root).toContain("--paper:" + THEME_PRESETS.console.dark.paper);
    expect(root).toContain("color-scheme:dark");
    // …and both selectors agree, so the toggle has nothing to flip.
    expect(css).toContain("--brand:" + THEME_PRESETS.console.dark.brand);
    // Dashed rules are the console voice.
    expect(css).toContain("--face-stroke-style:dashed");
  });

  it("paints lantern's atmosphere through the paper background token", () => {
    const css = buildThemeCss({ ...DEFAULT_THEME_CONFIG, preset: "lantern" });
    expect(css).toContain("--face-paper-bg:radial-gradient");
  });
});
