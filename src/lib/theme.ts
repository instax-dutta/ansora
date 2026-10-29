/**
 * Visual theme engine.
 *
 * Curated presets (amberglow / abyss / moss / noir / neongrid / synthwave /
 * raku / ember / aurora / galaxy / solstice / prism / velvet / monolith / horizon),
 * each with a complete light and dark palette.
 */
import type { ThemeConfig } from "@/lib/content/types";

/* ------------------------------- Presets --------------------------------- */

export type ThemePreset =
  | "amberglow" | "abyss" | "moss" | "noir" | "neongrid" | "synthwave"
  | "raku" | "ember" | "aurora" | "galaxy" | "solstice" | "prism"
  | "velvet" | "monolith" | "horizon";
export type RadiusStyle = "sharp" | "soft" | "rounded";
export type HeadingFont = "serif" | "sans";

export interface Palette {
  paper: string; surface: string; surfaceSoft: string; ink: string; inkMuted: string;
  line: string; lineStrong: string; brand: string; brandStrong: string; brandSoft: string; onBrand: string;
}

export interface ThemePresetDef {
  id: ThemePreset; label: string; tagline: string; radius: RadiusStyle; headingFont: HeadingFont;
  light: Palette; dark: Palette;
}

export const THEME_PRESETS: Record<ThemePreset, ThemePresetDef> = {
  amberglow: { id:"amberglow", label:"Amberglow", tagline:"Burnt honey, spiced parchment, old-world warmth.", radius:"soft", headingFont:"serif", light:{paper:"#f9f5ee",surface:"#ffffff",surfaceSoft:"#f3ebe0",ink:"#231c14",inkMuted:"#786b58",line:"#e6d9c7",lineStrong:"#d5c2a9",brand:"#c2410c",brandStrong:"#9a3412",brandSoft:"#fbe7d9",onBrand:"#fff7f0"}, dark:{paper:"#15100b",surface:"#201914",surfaceSoft:"#2a2018",ink:"#f0e7dc",inkMuted:"#b9a995",line:"#40362b",lineStrong:"#534638",brand:"#fb923c",brandStrong:"#fdba74",brandSoft:"#442813",onBrand:"#1a120b"} },
  abyss: { id:"abyss", label:"Abyss", tagline:"Bioluminescent depths, electric cyan glow.", radius:"soft", headingFont:"sans", light:{paper:"#f0f8fb",surface:"#ffffff",surfaceSoft:"#e6f4f8",ink:"#0f1f26",inkMuted:"#4d6673",line:"#d3e6ee",lineStrong:"#b6d3e0",brand:"#0891b2",brandStrong:"#0e7490",brandSoft:"#cffafe",onBrand:"#f0fdff"}, dark:{paper:"#050d14",surface:"#0b1620",surfaceSoft:"#11212d",ink:"#e6f6fa",inkMuted:"#7fa3b5",line:"#1f3240",lineStrong:"#2a4355",brand:"#22d3ee",brandStrong:"#67e8f9",brandSoft:"#0f2f3a",onBrand:"#041418"} },
  moss: { id:"moss", label:"Moss", tagline:"Damp woodland moss, chartreuse fireflies.", radius:"soft", headingFont:"serif", light:{paper:"#f6f8f3",surface:"#ffffff",surfaceSoft:"#eef4e6",ink:"#1c2416",inkMuted:"#5f6d4f",line:"#dce5d0",lineStrong:"#c7d4b5",brand:"#65a30d",brandStrong:"#4d7c0f",brandSoft:"#ecf7dc",onBrand:"#f7fdf0"}, dark:{paper:"#0f130a",surface:"#171d12",surfaceSoft:"#202a18",ink:"#e8f0df",inkMuted:"#a3b18a",line:"#2d3924",lineStrong:"#3b4930",brand:"#a3e635",brandStrong:"#bef264",brandSoft:"#253414",onBrand:"#131a0b"} },
  noir: { id:"noir", label:"Noir", tagline:"Velvet noir, champagne gold, cinematic drama.", radius:"soft", headingFont:"serif", light:{paper:"#f7f6f4",surface:"#ffffff",surfaceSoft:"#f0eeea",ink:"#16141c",inkMuted:"#605d6b",line:"#e3e0dc",lineStrong:"#d1ccc7",brand:"#b8860b",brandStrong:"#8b6508",brandSoft:"#f5ecd0",onBrand:"#fffaf0"}, dark:{paper:"#08070c",surface:"#121019",surfaceSoft:"#191725",ink:"#ece9f3",inkMuted:"#9b95b0",line:"#292535",lineStrong:"#383346",brand:"#f59e0b",brandStrong:"#fbbf24",brandSoft:"#2a2210",onBrand:"#161008"} },
  neongrid: { id:"neongrid", label:"NeonGrid", tagline:"Vaporwave terminals, hot magenta meets cyan.", radius:"sharp", headingFont:"sans", light:{paper:"#fbf8ff",surface:"#f6f3ff",surfaceSoft:"#f1ebff",ink:"#1a1528",inkMuted:"#5e5478",line:"#e5dcf9",lineStrong:"#d4c6f5",brand:"#a855f7",brandStrong:"#9333ea",brandSoft:"#f3e8ff",onBrand:"#fbf7ff"}, dark:{paper:"#0a0614",surface:"#151022",surfaceSoft:"#1d152b",ink:"#f3edff",inkMuted:"#b8a7e3",line:"#32274a",lineStrong:"#463460",brand:"#c084fc",brandStrong:"#d8b4fe",brandSoft:"#2a1a42",onBrand:"#120b1f"} },
  synthwave: { id:"synthwave", label:"Synthwave", tagline:"Midnight grid, pink-cyan neon haze.", radius:"sharp", headingFont:"sans", light:{paper:"#130b1c",surface:"#1f152b",surfaceSoft:"#251a34",ink:"#f7f0ff",inkMuted:"#c4b5fd",line:"#392a52",lineStrong:"#4f3a6b",brand:"#f472b6",brandStrong:"#ec4899",brandSoft:"#3a1f35",onBrand:"#1f1027"}, dark:{paper:"#080510",surface:"#120b1f",surfaceSoft:"#160f25",ink:"#f7f0ff",inkMuted:"#c4b5fd",line:"#2d2240",lineStrong:"#3f2f5c",brand:"#f9a8d4",brandStrong:"#f472b6",brandSoft:"#2b172a",onBrand:"#1a0f1f"} },
  raku: { id:"raku", label:"Raku", tagline:"Japanese tea ceremony, blush clay, lacquer warmth.", radius:"soft", headingFont:"serif", light:{paper:"#f9f6f2",surface:"#ffffff",surfaceSoft:"#f5f0e9",ink:"#1f1913",inkMuted:"#6b5d4f",line:"#e7ded2",lineStrong:"#d6c7b6",brand:"#b45309",brandStrong:"#92400e",brandSoft:"#f7e6d3",onBrand:"#fff8f0"}, dark:{paper:"#16110b",surface:"#211a13",surfaceSoft:"#2a2017",ink:"#f0e6d8",inkMuted:"#b9a389",line:"#3f3328",lineStrong:"#524336",brand:"#f59e0b",brandStrong:"#fbbf24",brandSoft:"#382a16",onBrand:"#1a140b"} },
  ember: { id:"ember", label:"Ember", tagline:"Smoldering mahogany, molten copper glow.", radius:"soft", headingFont:"serif", light:{paper:"#18110b",surface:"#231a13",surfaceSoft:"#2b2016",ink:"#f5e6d3",inkMuted:"#d4b896",line:"#3d2f23",lineStrong:"#513d2d",brand:"#fb923c",brandStrong:"#fdba74",brandSoft:"#3a2413",onBrand:"#1a1109"}, dark:{paper:"#120d09",surface:"#1a1510",surfaceSoft:"#211a14",ink:"#f5e6d3",inkMuted:"#d4b896",line:"#332820",lineStrong:"#443429",brand:"#fdba74",brandStrong:"#fed7aa",brandSoft:"#342315",onBrand:"#1a120b"} },
  aurora: { id:"aurora", label:"Aurora", tagline:"Arctic glass, spectral pink-violet aurora.", radius:"rounded", headingFont:"sans", light:{paper:"#f8f9ff",surface:"#ffffff",surfaceSoft:"#f1f4ff",ink:"#0f1026",inkMuted:"#565b7a",line:"#e3e6ff",lineStrong:"#cfd2ff",brand:"#6366f1",brandStrong:"#4f46e5",brandSoft:"#eef2ff",onBrand:"#f8f9ff"}, dark:{paper:"#060814",surface:"#101225",surfaceSoft:"#171a2e",ink:"#f0f2ff",inkMuted:"#a5a9d6",line:"#262a4a",lineStrong:"#353a63",brand:"#818cf8",brandStrong:"#a5b4fc",brandSoft:"#1e1f3d",onBrand:"#0f1026"} },
  galaxy: { id:"galaxy", label:"Galaxy", tagline:"Cosmic void, holographic magenta-cyan shimmer.", radius:"rounded", headingFont:"sans", light:{paper:"#070510",surface:"#110d1f",surfaceSoft:"#170f29",ink:"#f3f0ff",inkMuted:"#b9b0e6",line:"#2a1f42",lineStrong:"#392b59",brand:"#a78bfa",brandStrong:"#c4b5fd",brandSoft:"#261b3f",onBrand:"#140f25"}, dark:{paper:"#040308",surface:"#0d091a",surfaceSoft:"#130e21",ink:"#f3f0ff",inkMuted:"#b9b0e6",line:"#201836",lineStrong:"#2d2247",brand:"#c4b5fd",brandStrong:"#ddd6fe",brandSoft:"#211a3a",onBrand:"#150f28"} },
  solstice: { id:"solstice", label:"Solstice", tagline:"Burnt orange sun, desert cream.", radius:"soft", headingFont:"serif", light:{paper:"#fdf7f0",surface:"#ffffff",surfaceSoft:"#f7efe5",ink:"#2a1a0f",inkMuted:"#7c5c3e",line:"#ecdcc9",lineStrong:"#dec5a6",brand:"#ea580c",brandStrong:"#c2410c",brandSoft:"#ffe4d6",onBrand:"#fff7f0"}, dark:{paper:"#140b06",surface:"#20130a",surfaceSoft:"#2a1810",ink:"#f7ebe0",inkMuted:"#d4b79a",line:"#3f2a1d",lineStrong:"#553628",brand:"#fb923c",brandStrong:"#fdba74",brandSoft:"#3a2214",onBrand:"#1a120b"} },
  prism: { id:"prism", label:"Prism", tagline:"Iridescent spectrum, holographic glass glow.", radius:"rounded", headingFont:"sans", light:{paper:"#f9f8ff",surface:"#ffffff",surfaceSoft:"#f4f1ff",ink:"#15122b",inkMuted:"#5b557a",line:"#e6e0ff",lineStrong:"#d6ceff",brand:"#8b5cf6",brandStrong:"#7c3aed",brandSoft:"#f3e8ff",onBrand:"#f9f8ff"}, dark:{paper:"#0a0814",surface:"#141029",surfaceSoft:"#1b1536",ink:"#f3f0ff",inkMuted:"#b8b0e8",line:"#2d254a",lineStrong:"#3c3263",brand:"#a78bfa",brandStrong:"#c4b5fd",brandSoft:"#251d42",onBrand:"#110d25"} },
  velvet: { id:"velvet", label:"Velvet", tagline:"Deep amethyst velvet, rose gold luminescence.", radius:"soft", headingFont:"serif", light:{paper:"#f9f6fa",surface:"#ffffff",surfaceSoft:"#f5eff7",ink:"#1f1626",inkMuted:"#6b5a75",line:"#e8dff0",lineStrong:"#d7c6e3",brand:"#a855f7",brandStrong:"#9333ea",brandSoft:"#f3e8ff",onBrand:"#fbf7ff"}, dark:{paper:"#0f0a14",surface:"#1a1223",surfaceSoft:"#23182d",ink:"#f3ecfa",inkMuted:"#c4b3d6",line:"#34283f",lineStrong:"#453552",brand:"#d8b4fe",brandStrong:"#e9d5ff",brandSoft:"#2d1f3a",onBrand:"#1a1026"} },
  monolith: { id:"monolith", label:"Monolith", tagline:"Brutalist concrete, stark contrast, electric cyan.", radius:"sharp", headingFont:"sans", light:{paper:"#f7f7f7",surface:"#ffffff",surfaceSoft:"#f0f0f0",ink:"#0a0a0a",inkMuted:"#4a4a4a",line:"#dcdcdc",lineStrong:"#bfbfbf",brand:"#06b6d4",brandStrong:"#0891b2",brandSoft:"#e0f7fa",onBrand:"#f0fdff"}, dark:{paper:"#050505",surface:"#0f0f0f",surfaceSoft:"#151515",ink:"#f5f5f5",inkMuted:"#a3a3a3",line:"#262626",lineStrong:"#3a3a3a",brand:"#22d3ee",brandStrong:"#67e8f9",brandSoft:"#0f2f36",onBrand:"#041418"} },
  horizon: { id:"horizon", label:"Horizon", tagline:"Twilight gradient sky, peach rose, indigo night.", radius:"rounded", headingFont:"serif", light:{paper:"#f9f7fc",surface:"#ffffff",surfaceSoft:"#f4f0fa",ink:"#1a1525",inkMuted:"#665a7a",line:"#e7e0f3",lineStrong:"#d5cbe6",brand:"#f59e0b",brandStrong:"#d97706",brandSoft:"#fef3c7",onBrand:"#1a120b"}, dark:{paper:"#0b0914",surface:"#151022",surfaceSoft:"#1d162b",ink:"#f3f0fa",inkMuted:"#b8a7d6",line:"#2f2542",lineStrong:"#3f3157",brand:"#fbbf24",brandStrong:"#f59e0b",brandSoft:"#2a2310",onBrand:"#1a140b"} },
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
  const preset = THEME_PRESETS[theme.preset] ?? THEME_PRESETS.amberglow;
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
