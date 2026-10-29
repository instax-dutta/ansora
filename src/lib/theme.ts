/**
 * Visual theme engine — "theme = voice".
 *
 * A curated preset is a *typographic identity*, not a color chip: besides a
 * light+dark palette it carries a face (density, body voice, display voice,
 * chrome, prose furniture, structural rules) that the layout consumes through
 * CSS variables, so switching preset changes the whole material of the site.
 *
 * Modes: a preset is either dual (light/dark toggle) or single-mode
 * (dark-only / light-only). A single-mode preset stores its one palette in
 * BOTH `light` and `dark` slots so the engine stays uniform, and the light/dark
 * toggle is hidden for it (Header checks `mode`).
 */
import type { ThemeConfig } from "@/lib/content/types";

/* ------------------------------- Presets --------------------------------- */

export type ThemePreset =
  | "inkline" | "broadsheet" | "folio" | "atelier"
  | "ledger" | "nocturne" | "console" | "lantern";
export type RadiusStyle = "sharp" | "soft" | "rounded";
export type HeadingFont = "serif" | "sans";

export type ThemeMode = "dual" | "dark" | "light";

/**
 * The typographic face of a preset — what makes a theme a material instead of
 * a palette. Every value lands in a CSS custom property; the layout, prose and
 * chrome consume them (see globals.css).
 */
export interface ThemeFace {
  /** Tailwind spacing unit — the density dial for the whole site. */
  density: string;
  bodyFont: "sans" | "serif";
  bodySize: string;
  leading: string;
  /** Body letter-spacing. Serif voices mostly stay "normal". */
  tracking: string;
  displayTracking: string;
  displayWeight: number;
  /** Labels (dates, bylines, tags, footer) — mono or sans. */
  chrome: "sans" | "mono";
  /** First paragraph gets a drop cap. */
  dropcap: boolean;
  /** Structural rule (header / footer / cards). */
  strokeWidth?: string;
  strokeStyle?: "solid" | "dashed";
  /** Rare: replaces the flat paper (gradient atmospheres). */
  paperBg?: string;
}

export interface Palette {
  paper: string; surface: string; surfaceSoft: string; ink: string; inkMuted: string;
  line: string; lineStrong: string; brand: string; brandStrong: string; brandSoft: string; onBrand: string;
}

export interface ThemePresetDef {
  id: ThemePreset; label: string; tagline: string; mode: ThemeMode;
  radius: RadiusStyle; headingFont: HeadingFont;
  light: Palette; dark: Palette; face: ThemeFace;
}

export const THEME_PRESETS: Record<ThemePreset, ThemePresetDef> = {
  inkline: {
    id: "inkline", label: "Inkline", mode: "dual",
    tagline: "Ink on paper by day, ink on slate by night.",
    radius: "soft", headingFont: "serif",
    light: { paper: "#f7f5f0", surface: "#ffffff", surfaceSoft: "#efeadf", ink: "#201c16", inkMuted: "#6d675e", line: "#e3dfd5", lineStrong: "#cfc9bc", brand: "#b4541e", brandStrong: "#934015", brandSoft: "#f7e7dc", onBrand: "#fdf6f0" },
    dark: { paper: "#13151b", surface: "#1a1d25", surfaceSoft: "#232630", ink: "#eae8e3", inkMuted: "#a09da3", line: "#2c2e3a", lineStrong: "#3d4050", brand: "#e0926a", brandStrong: "#ecaf8d", brandSoft: "#38251a", onBrand: "#170d07" },
    face: { density: "0.255rem", bodyFont: "sans", bodySize: "1.03rem", leading: "1.72", tracking: "0", displayTracking: "-0.025em", displayWeight: 620, chrome: "sans", dropcap: false },
  },
  broadsheet: {
    id: "broadsheet", label: "Broadsheet", mode: "dual",
    tagline: "Set like a front page: serif body, mono bylines, rules and drop caps.",
    radius: "sharp", headingFont: "serif",
    light: { paper: "#faf9f5", surface: "#ffffff", surfaceSoft: "#f1efe8", ink: "#191713", inkMuted: "#5c574e", line: "#e2dfd5", lineStrong: "#bcb7ab", brand: "#8c2e1e", brandStrong: "#6f2417", brandSoft: "#f6e5df", onBrand: "#fdf5f2" },
    dark: { paper: "#141311", surface: "#1c1b19", surfaceSoft: "#242220", ink: "#e8e5df", inkMuted: "#a5a095", line: "#2d2b28", lineStrong: "#3e3a36", brand: "#e39a84", brandStrong: "#eec1b0", brandSoft: "#3a231d", onBrand: "#170e0a" },
    face: { density: "0.235rem", bodyFont: "serif", bodySize: "1.03rem", leading: "1.75", tracking: "0.003em", displayTracking: "-0.008em", displayWeight: 700, chrome: "mono", dropcap: true, strokeWidth: "1.5px" },
  },
  folio: {
    id: "folio", label: "Folio", mode: "dual",
    tagline: "A quiet paperback: lingering serif, drop caps, forest thread.",
    radius: "soft", headingFont: "serif",
    light: { paper: "#f8f6ef", surface: "#ffffff", surfaceSoft: "#efebe0", ink: "#22201a", inkMuted: "#6b675c", line: "#e3ded1", lineStrong: "#cbc5b5", brand: "#276b52", brandStrong: "#1e5442", brandSoft: "#e3f0e8", onBrand: "#f6fbf8" },
    dark: { paper: "#131610", surface: "#1b1f17", surfaceSoft: "#232920", ink: "#e9ecdf", inkMuted: "#a4ab98", line: "#2b3126", lineStrong: "#3c4436", brand: "#8fd0ad", brandStrong: "#b0e2c8", brandSoft: "#1e3629", onBrand: "#0c1712" },
    face: { density: "0.275rem", bodyFont: "serif", bodySize: "1.05rem", leading: "1.8", tracking: "0.002em", displayTracking: "-0.02em", displayWeight: 640, chrome: "sans", dropcap: true },
  },
  atelier: {
    id: "atelier", label: "Atelier", mode: "dual",
    tagline: "Gallery air: near-monochrome, light display, cornices of white space.",
    radius: "rounded", headingFont: "sans",
    light: { paper: "#f7f7f5", surface: "#ffffff", surfaceSoft: "#efefec", ink: "#1d1d20", inkMuted: "#6f6f74", line: "#e6e6e2", lineStrong: "#cfcfca", brand: "#1c1c1f", brandStrong: "#0e0e10", brandSoft: "#ececec", onBrand: "#ffffff" },
    dark: { paper: "#101012", surface: "#17171a", surfaceSoft: "#1e1e22", ink: "#ebecee", inkMuted: "#9c9ca3", line: "#2b2b30", lineStrong: "#3d3d44", brand: "#e6e6ea", brandStrong: "#f4f4f6", brandSoft: "#26262b", onBrand: "#131316" },
    face: { density: "0.3rem", bodyFont: "sans", bodySize: "1.02rem", leading: "1.78", tracking: "0.002em", displayTracking: "-0.035em", displayWeight: 480, chrome: "sans", dropcap: false },
  },
  ledger: {
    id: "ledger", label: "Ledger", mode: "dual",
    tagline: "An engineer's log: mono stamps, ruled lines, ledger green.",
    radius: "sharp", headingFont: "sans",
    light: { paper: "#fbfcfa", surface: "#ffffff", surfaceSoft: "#f1f4f0", ink: "#101f16", inkMuted: "#5d6b61", line: "#dfe6df", lineStrong: "#b9c4ba", brand: "#157347", brandStrong: "#0f5c36", brandSoft: "#e0f2e7", onBrand: "#f5fcf7" },
    dark: { paper: "#070d0a", surface: "#0d1712", surfaceSoft: "#122019", ink: "#dcefe2", inkMuted: "#89a795", line: "#1d3327", lineStrong: "#2a4636", brand: "#34d399", brandStrong: "#6ee7b7", brandSoft: "#10362a", onBrand: "#05130d" },
    face: { density: "0.235rem", bodyFont: "sans", bodySize: "0.97rem", leading: "1.66", tracking: "0", displayTracking: "-0.005em", displayWeight: 600, chrome: "mono", dropcap: false },
  },
  nocturne: {
    id: "nocturne", label: "Nocturne", mode: "dark",
    tagline: "A midnight reading chamber — moonlit amber, generous leading.",
    radius: "soft", headingFont: "serif",
    light: { paper: "#0a0c16", surface: "#12141f", surfaceSoft: "#191c2a", ink: "#e8e7ec", inkMuted: "#a0a3bb", line: "#232739", lineStrong: "#333855", brand: "#e0b354", brandStrong: "#eec97e", brandSoft: "#332a12", onBrand: "#171004" },
    dark: { paper: "#0a0c16", surface: "#12141f", surfaceSoft: "#191c2a", ink: "#e8e7ec", inkMuted: "#a0a3bb", line: "#232739", lineStrong: "#333855", brand: "#e0b354", brandStrong: "#eec97e", brandSoft: "#332a12", onBrand: "#171004" },
    face: { density: "0.275rem", bodyFont: "sans", bodySize: "1.06rem", leading: "1.85", tracking: "0", displayTracking: "-0.02em", displayWeight: 600, chrome: "sans", dropcap: false },
  },
  console: {
    id: "console", label: "Console", mode: "dark",
    tagline: "Phosphor terminal: mono chrome, dashed rules, compiled look.",
    radius: "sharp", headingFont: "sans",
    light: { paper: "#060b08", surface: "#0c1510", surfaceSoft: "#101c15", ink: "#d3ecdc", inkMuted: "#85ab94", line: "#1d2d22", lineStrong: "#2b4233", brand: "#3ddc97", brandStrong: "#7feebc", brandSoft: "#0e2f22", onBrand: "#04120c" },
    dark: { paper: "#060b08", surface: "#0c1510", surfaceSoft: "#101c15", ink: "#d3ecdc", inkMuted: "#85ab94", line: "#1d2d22", lineStrong: "#2b4233", brand: "#3ddc97", brandStrong: "#7feebc", brandSoft: "#0e2f22", onBrand: "#04120c" },
    face: { density: "0.225rem", bodyFont: "sans", bodySize: "0.95rem", leading: "1.68", tracking: "0", displayTracking: "0", displayWeight: 560, chrome: "mono", dropcap: false, strokeStyle: "dashed" },
  },
  lantern: {
    id: "lantern", label: "Lantern", mode: "dark",
    tagline: "Harbor night — gradient paper, lamplight amber.",
    radius: "soft", headingFont: "serif",
    light: { paper: "#0a0e1c", surface: "#131829", surfaceSoft: "#1a2035", ink: "#eae9e1", inkMuted: "#a4a3b6", line: "#252b45", lineStrong: "#373e60", brand: "#ffb454", brandStrong: "#ffcb84", brandSoft: "#33240e", onBrand: "#190f02" },
    dark: { paper: "#0a0e1c", surface: "#131829", surfaceSoft: "#1a2035", ink: "#eae9e1", inkMuted: "#a4a3b6", line: "#252b45", lineStrong: "#373e60", brand: "#ffb454", brandStrong: "#ffcb84", brandSoft: "#33240e", onBrand: "#190f02" },
    face: {
      density: "0.285rem", bodyFont: "sans", bodySize: "1.05rem", leading: "1.8", tracking: "0.001em",
      displayTracking: "-0.02em", displayWeight: 620, chrome: "sans", dropcap: false,
      paperBg: "radial-gradient(1100px 480px at 50% -140px, rgba(255,180,84,0.09), rgba(255,180,84,0) 65%, no-repeat), linear-gradient(#0a0e1c, #0a0e1c) fixed",
    },
  },
};

/* ------------------------- Font stacks for faces -------------------------- */

const BODY_STACKS: Record<ThemeFace["bodyFont"], string> = {
  sans: "var(--font-figtree), ui-sans-serif, system-ui, sans-serif",
  serif: "var(--font-fraunces), ui-serif, Georgia, serif",
};

const CHROME_STACKS: Record<ThemeFace["chrome"], string> = {
  sans: "var(--font-figtree), ui-sans-serif, system-ui, sans-serif",
  mono: 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace',
};

/* --------------------------- Radius & fonts ------------------------------- */

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

export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const ON_BRAND_LIGHT = "#16130e";
const ON_BRAND_DARK = "#fffaf4";

export function textOn(hex: string): string {
  return contrast(ON_BRAND_DARK, hex) >= contrast(ON_BRAND_LIGHT, hex)
    ? ON_BRAND_DARK
    : ON_BRAND_LIGHT;
}

/* ----------------------------- Resolution --------------------------------- */

export function resolveTheme(theme: ThemeConfig): { light: Palette; dark: Palette } {
  const preset = THEME_PRESETS[theme.preset] ?? THEME_PRESETS.inkline;
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
 * The face of a preset as CSS custom properties. A single face covers both
 * color modes (the palette is what changes between them), so the same values
 * are emitted under `html:root` and `html.dark`.
 */
function faceVars(face: ThemeFace): Record<string, string> {
  const vars: Record<string, string> = {
    "--face-density": face.density,
    "--face-body-font": BODY_STACKS[face.bodyFont],
    "--face-body-size": face.bodySize,
    "--face-leading": face.leading,
    "--face-tracking": face.tracking,
    "--face-display-tracking": face.displayTracking,
    "--face-display-weight": String(face.displayWeight),
    "--face-chrome-font": CHROME_STACKS[face.chrome],
    "--face-stroke-width": face.strokeWidth ?? "1px",
    "--face-stroke-style": face.strokeStyle ?? "solid",
    "--face-dropcap-float": face.dropcap ? "left" : "none",
    "--face-dropcap-size": face.dropcap ? "3.1em" : "1em",
    "--face-dropcap-pad": face.dropcap ? "0.08em" : "0em",
  };
  if (face.paperBg) vars["--face-paper-bg"] = face.paperBg;
  return vars;
}

export function buildThemeCss(theme: ThemeConfig): string {
  const preset = THEME_PRESETS[theme.preset] ?? THEME_PRESETS.inkline;
  const { light, dark } = resolveTheme(theme);
  const radius = RADIUS_SCALES[theme.radius] ?? RADIUS_SCALES.soft;
  const serifStack =
    theme.headingFont === "sans"
      ? "var(--font-figtree), ui-sans-serif, system-ui, sans-serif"
      : "var(--font-fraunces), ui-serif, Georgia, serif";
  const face = faceVars(preset.face);

  // A darkness-first preset carries its one look in both slots: `html:root`
  // inherits the dark palette and declares a dark color scheme, so the
  // light/dark toggle (or a `prefers-color-scheme`) has no way to flip it.
  const rootPalette = preset.mode === "dark" ? dark : light;
  const rootScheme = preset.mode === "dark" ? "dark" : "light";

  const rootVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(rootPalette) as [keyof Palette, string][]) {
    rootVars[PALETTE_CSS_NAMES[key]] = value;
  }

  const darkVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(dark) as [keyof Palette, string][]) {
    darkVars[PALETTE_CSS_NAMES[key]] = value;
  }

  return (
    `html:root{${cssVars(rootVars)};${cssVars(face)};${cssVars(radius)};--font-serif:${serifStack};color-scheme:${rootScheme}}` +
    `html.dark{${cssVars(darkVars)};${cssVars(face)};color-scheme:dark}`
  );
}
