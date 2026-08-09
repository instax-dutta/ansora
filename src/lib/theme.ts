/**
 * Visual theme engine.
 *
 * Four curated presets (warm / ocean / forest / midnight), each with a
 * complete light and dark palette. Admins pick a preset from Settings →
 * Appearance and can
 * override the accent color, corner radius, and heading font. The resolved
 * values are emitted as CSS custom properties by `buildThemeCss()` and
 * injected into the root layout, so the whole site (public + admin) restyles
 * without a rebuild of the app code — only a content commit.
 *
 * The variables here are the "live tokens" consumed by Tailwind v4 via the
 * `@theme inline` block in globals.css (bg-paper, text-ink, border-line,
 * bg-brand, …). Overriding them at runtime re-skins every component.
 */
import type { ThemeConfig } from "@/lib/content/types";

/* ------------------------------- Presets --------------------------------- */

export type ThemePreset = "warm" | "ocean" | "forest" | "midnight";
export type RadiusStyle = "sharp" | "soft" | "rounded";
export type HeadingFont = "serif" | "sans";

export interface Palette {
  paper: string;
  surface: string;
  surfaceSoft: string;
  ink: string;
  inkMuted: string;
  line: string;
  lineStrong: string;
  brand: string;
  brandStrong: string;
  brandSoft: string;
  onBrand: string;
}

export interface ThemePresetDef {
  id: ThemePreset;
  label: string;
  tagline: string;
  light: Palette;
  dark: Palette;
}

export const THEME_PRESETS: Record<ThemePreset, ThemePresetDef> = {
  warm: {
    id: "warm",
    label: "Warm",
    tagline: "Cream paper, terracotta ink, serif charm.",
    light: {
      paper: "#faf6f0",
      surface: "#ffffff",
      surfaceSoft: "#f4ede2",
      ink: "#2a241c",
      inkMuted: "#6e6558",
      line: "#e8dfd2",
      lineStrong: "#d9cdbb",
      brand: "#b04e14",
      brandStrong: "#8f3c0d",
      brandSoft: "#f6e7db",
      onBrand: "#fffaf4",
    },
    dark: {
      paper: "#16120e",
      surface: "#201a14",
      surfaceSoft: "#282117",
      ink: "#ede6da",
      inkMuted: "#a89e8e",
      line: "#3a3126",
      lineStrong: "#4a3e2f",
      brand: "#e08151",
      brandStrong: "#f0a06f",
      brandSoft: "#3a2416",
      onBrand: "#1c1109",
    },
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    tagline: "Cool slate blues with a bright teal accent.",
    light: {
      paper: "#f2f7fa",
      surface: "#ffffff",
      surfaceSoft: "#e5eef5",
      ink: "#14232e",
      inkMuted: "#5a6b79",
      line: "#d7e3ec",
      lineStrong: "#c0d2df",
      brand: "#0f6d86",
      brandStrong: "#0b5569",
      brandSoft: "#d9eef4",
      onBrand: "#f4fbfe",
    },
    dark: {
      paper: "#0c1419",
      surface: "#131e25",
      surfaceSoft: "#1a2831",
      ink: "#e2edf3",
      inkMuted: "#8fa5b3",
      line: "#243540",
      lineStrong: "#314757",
      brand: "#4fb3cd",
      brandStrong: "#79c9de",
      brandSoft: "#102c36",
      onBrand: "#062029",
    },
  },
  forest: {
    id: "forest",
    label: "Forest",
    tagline: "Earthy greens on paper with a fresh eucalyptus accent.",
    light: {
      paper: "#f5f7f0",
      surface: "#ffffff",
      surfaceSoft: "#eaefe0",
      ink: "#22281c",
      inkMuted: "#69715c",
      line: "#dfe4d2",
      lineStrong: "#c8d1b8",
      brand: "#4d7c37",
      brandStrong: "#3c6329",
      brandSoft: "#e4eeda",
      onBrand: "#f8fbf2",
    },
    dark: {
      paper: "#111510",
      surface: "#181d15",
      surfaceSoft: "#20271c",
      ink: "#e6ead9",
      inkMuted: "#9fa790",
      line: "#2f3728",
      lineStrong: "#3e4a36",
      brand: "#8fbe6b",
      brandStrong: "#a9d089",
      brandSoft: "#22301a",
      onBrand: "#0e1608",
    },
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    tagline: "Navy backgrounds, warm gold accent, moody and refined.",
    light: {
      paper: "#f5f3f0",
      surface: "#ffffff",
      surfaceSoft: "#ece8e2",
      ink: "#1a1d2b",
      inkMuted: "#6a6e7c",
      line: "#e0dbd8",
      lineStrong: "#cdc5c0",
      brand: "#a67c00",
      brandStrong: "#7d5e00",
      brandSoft: "#f2e8c8",
      onBrand: "#fffcf5",
    },
    dark: {
      paper: "#0d0f17",
      surface: "#151822",
      surfaceSoft: "#1c1f2c",
      ink: "#dfdfe8",
      inkMuted: "#8b8f9e",
      line: "#2a2e3d",
      lineStrong: "#3a3f52",
      brand: "#d4a017",
      brandStrong: "#e0b832",
      brandSoft: "#1c1e14",
      onBrand: "#0c0a05",
    },
  },
};

/* --------------------------- Radius & fonts ------------------------------- */

/** Corner-radius scales mapped onto Tailwind v4's `--radius-*` tokens. */
export const RADIUS_SCALES: Record<
  RadiusStyle,
  Record<string, string>
> = {
  sharp: {
    "--radius-sm": "0.125rem",
    "--radius-md": "0.1875rem",
    "--radius-lg": "0.25rem",
    "--radius-xl": "0.375rem",
    "--radius-2xl": "0.5rem",
  },
  soft: {
    "--radius-sm": "0.25rem",
    "--radius-md": "0.375rem",
    "--radius-lg": "0.5rem",
    "--radius-xl": "0.75rem",
    "--radius-2xl": "1rem",
  },
  rounded: {
    "--radius-sm": "0.375rem",
    "--radius-md": "0.5rem",
    "--radius-lg": "0.75rem",
    "--radius-xl": "1.125rem",
    "--radius-2xl": "1.5rem",
  },
};

export const RADIUS_LABELS: Record<RadiusStyle, string> = {
  sharp: "Sharp",
  soft: "Soft",
  rounded: "Rounded",
};

export const HEADING_FONT_LABELS: Record<HeadingFont, string> = {
  serif: "Serif",
  sans: "Sans",
};

/* ------------------------ Preset accent swatches -------------------------- */

/** Curated accent colors shown as quick-pick chips in the Appearance form. */
export interface AccentSwatch {
  label: string;
  hex: string;
}

export const ACCENT_SWATCHES: AccentSwatch[] = [
  { label: "Terracotta", hex: "#b04e14" },
  { label: "Teal", hex: "#0f6d86" },
  { label: "Forest", hex: "#4d7c37" },
  { label: "Gold", hex: "#d4a017" },
  { label: "Ruby", hex: "#c0392b" },
  { label: "Plum", hex: "#7b2d8e" },
  { label: "Sky", hex: "#2980b9" },
  { label: "Emerald", hex: "#27ae60" },
];

/* ----------------------------- Color helpers ------------------------------ */

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Linear interpolation between two hex colors. weight 0 → a, 1 → b. */
export function mix(a: string, b: string, weight: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * weight,
    g: ca.g + (cb.g - ca.g) * weight,
    b: ca.b + (cb.b - ca.b) * weight,
  });
}

/** WCAG relative luminance (0–1). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors (1–21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const ON_BRAND_LIGHT = "#16130e";
const ON_BRAND_DARK = "#fffaf4";

/**
 * Picks a readable foreground (--on-brand) for a given background: the one of
 * near-black / near-white with the higher WCAG contrast. Arbitrary user
 * accents can land anywhere on the lightness scale, so the max-contrast
 * choice keeps small text (buttons, chips, badges) as close to AA as a
 * two-color system allows.
 */
export function textOn(hex: string): string {
  return contrast(ON_BRAND_DARK, hex) >= contrast(ON_BRAND_LIGHT, hex)
    ? ON_BRAND_DARK
    : ON_BRAND_LIGHT;
}

/* ----------------------------- Resolution --------------------------------- */

/**
 * Resolve a ThemeConfig into concrete light + dark palettes, applying the
 * custom accent override (deriving the strong/soft/on-brand variants).
 */
export function resolveTheme(theme: ThemeConfig): { light: Palette; dark: Palette } {
  const preset = THEME_PRESETS[theme.preset] ?? THEME_PRESETS.warm;
  const accent = (theme.accent ?? "").trim();
  if (!accent || !hexToRgb(accent)) {
    return { light: preset.light, dark: preset.dark };
  }
  return {
    light: {
      ...preset.light,
      brand: accent,
      brandStrong: mix(accent, "#000000", 0.22),
      brandSoft: mix(accent, "#ffffff", 0.82),
      onBrand: textOn(accent),
    },
    dark: {
      ...preset.dark,
      brand: mix(accent, "#ffffff", 0.25),
      brandStrong: mix(accent, "#ffffff", 0.45),
      brandSoft: mix(accent, "#000000", 0.74),
      onBrand: textOn(mix(accent, "#ffffff", 0.25)),
    },
  };
}

const PALETTE_CSS_NAMES: Record<keyof Palette, string> = {
  paper: "--paper",
  surface: "--surface",
  surfaceSoft: "--surface-soft",
  ink: "--ink",
  inkMuted: "--ink-muted",
  line: "--line",
  lineStrong: "--line-strong",
  brand: "--brand",
  brandStrong: "--brand-strong",
  brandSoft: "--brand-soft",
  onBrand: "--on-brand",
};

function cssVars(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

/**
 * Emit the full CSS custom-property block for a theme. Selectors use
 * `html:root` / `html.dark` so they beat globals.css's `:root` / `.dark`
 * regardless of style-sheet order.
 */
export function buildThemeCss(theme: ThemeConfig): string {
  const { light, dark } = resolveTheme(theme);
  const radius = RADIUS_SCALES[theme.radius] ?? RADIUS_SCALES.soft;
  const serifStack =
    theme.headingFont === "sans"
      ? "var(--font-figtree), ui-sans-serif, system-ui, sans-serif"
      : "var(--font-fraunces), ui-serif, Georgia, serif";

  const lightVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(light) as [keyof Palette, string][]) {
    lightVars[PALETTE_CSS_NAMES[key]] = value;
  }

  const darkVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(dark) as [keyof Palette, string][]) {
    darkVars[PALETTE_CSS_NAMES[key]] = value;
  }

  return (
    `html:root{${cssVars(lightVars)};${cssVars(radius)};--font-serif:${serifStack};color-scheme:light}` +
    `html.dark{${cssVars(darkVars)};color-scheme:dark}`
  );
}
