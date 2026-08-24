/**
 * Founder-managed global typography. Persist as JSONB on site_settings.
 * Applied only via CSS custom properties — never inline text styles — so SSR
 * and the client hydrate the same markup.
 */

export type TypeScaleRatioKey =
  | "minorSecond"
  | "majorSecond"
  | "minorThird"
  | "majorThird"
  | "perfectFourth"
  | "augmentedFourth"
  | "perfectFifth"
  | "golden";

export type FontFamilyKey =
  | "inter"
  | "roboto"
  | "plusJakarta"
  | "playfair"
  | "merriweather"
  | "fraunces"
  | "mono"
  | "system";

export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";

export type ColorPaletteKey = "corporateDark" | "pastel" | "highContrast" | "night" | "minimal";

export type TypographySettings = {
  bodySizePx: number;
  h1SizeRem: number;
  h2SizeRem: number;
  h3SizeRem: number;
  h4SizeRem: number;
  scaleRatio: TypeScaleRatioKey;
  letterSpacingPx: number;
  headingLetterSpacingPx: number;
  lineHeight: number;
  headingLineHeight: number;
  primaryText: string;
  mutedText: string;
  headingText: string;
  accent: string;
  accentHover: string;
  fontFamily: FontFamilyKey;
  headingFontFamily: FontFamilyKey;
  fontWeight: number;
  headingFontWeight: number;
  textTransform: TextTransform;
  headingTransform: TextTransform;
  italic: boolean;
  headingItalic: boolean;
  underline: boolean;
  headingUnderline: boolean;
  shadowEnabled: boolean;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
};

export const TYPE_SCALE_RATIOS: Record<TypeScaleRatioKey, { label: string; ratio: number }> = {
  minorSecond: { label: "Minor Second (1.067)", ratio: 1.067 },
  majorSecond: { label: "Major Second (1.125)", ratio: 1.125 },
  minorThird: { label: "Minor Third (1.200)", ratio: 1.2 },
  majorThird: { label: "Major Third (1.250)", ratio: 1.25 },
  perfectFourth: { label: "Perfect Fourth (1.333)", ratio: 1.333 },
  augmentedFourth: { label: "Augmented Fourth (1.414)", ratio: 1.414 },
  perfectFifth: { label: "Perfect Fifth (1.500)", ratio: 1.5 },
  golden: { label: "Golden Ratio (1.618)", ratio: 1.618 },
};

export const FONT_FAMILIES: Record<
  FontFamilyKey,
  { label: string; stack: string; google: string | null; category: string }
> = {
  inter: {
    label: "Inter",
    stack: '"Inter", ui-sans-serif, system-ui, sans-serif',
    google: "Inter:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700",
    category: "Modern Sans-Serif",
  },
  roboto: {
    label: "Roboto",
    stack: '"Roboto", ui-sans-serif, system-ui, sans-serif',
    google: "Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,400;1,700",
    category: "Modern Sans-Serif",
  },
  plusJakarta: {
    label: "Plus Jakarta Sans",
    stack: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    google: "Plus+Jakarta+Sans:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700",
    category: "Modern Sans-Serif",
  },
  playfair: {
    label: "Playfair Display",
    stack: '"Playfair Display", ui-serif, Georgia, serif',
    google: "Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700",
    category: "Classic Serif",
  },
  merriweather: {
    label: "Merriweather",
    stack: '"Merriweather", ui-serif, Georgia, serif',
    google: "Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700",
    category: "Classic Serif",
  },
  fraunces: {
    label: "Fraunces",
    stack: '"Fraunces", ui-serif, Georgia, serif',
    google: "Fraunces:ital,opsz,wght@0,9..144,100;0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,700",
    category: "Classic Serif",
  },
  mono: {
    label: "JetBrains Mono",
    stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    google: "JetBrains+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,400",
    category: "Monospace",
  },
  system: {
    label: "Sistem Varsayılanı",
    stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    google: null,
    category: "Sistem",
  },
};

export const COLOR_PALETTES: Record<
  ColorPaletteKey,
  {
    label: string;
    hint: string;
    colors: Pick<TypographySettings, "primaryText" | "mutedText" | "headingText" | "accent" | "accentHover">;
  }
> = {
  corporateDark: {
    label: "Kurumsal Dark",
    hint: "Lacivert başlık, güvenilir kurumsal metin",
    colors: {
      primaryText: "#1e293b",
      mutedText: "#64748b",
      headingText: "#0f172a",
      accent: "#1d4ed8",
      accentHover: "#1e40af",
    },
  },
  pastel: {
    label: "Pastel",
    hint: "Yumuşak lavanta ve gül tonları",
    colors: {
      primaryText: "#4c3d5c",
      mutedText: "#8b7a9b",
      headingText: "#3d2b4f",
      accent: "#c08497",
      accentHover: "#a86b80",
    },
  },
  highContrast: {
    label: "Yüksek Kontrast",
    hint: "WCAG AAA odaklı siyah / sarı vurgu",
    colors: {
      primaryText: "#000000",
      mutedText: "#1a1a1a",
      headingText: "#000000",
      accent: "#005fcc",
      accentHover: "#0047a3",
    },
  },
  night: {
    label: "Gece Modu",
    hint: "Koyu zemin için açık metin (arka planı da koyulaştırın)",
    colors: {
      primaryText: "#e2e8f0",
      mutedText: "#94a3b8",
      headingText: "#f8fafc",
      accent: "#38bdf8",
      accentHover: "#7dd3fc",
    },
  },
  minimal: {
    label: "Minimal",
    hint: "Nötr gri, sade vurgu",
    colors: {
      primaryText: "#374151",
      mutedText: "#9ca3af",
      headingText: "#111827",
      accent: "#111827",
      accentHover: "#4b5563",
    },
  },
};

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  bodySizePx: 16,
  h1SizeRem: 2.25,
  h2SizeRem: 1.75,
  h3SizeRem: 1.35,
  h4SizeRem: 1.125,
  scaleRatio: "majorThird",
  letterSpacingPx: 0,
  headingLetterSpacingPx: -0.3,
  lineHeight: 1.6,
  headingLineHeight: 1.25,
  primaryText: "#1a1a1a",
  mutedText: "#6b7280",
  headingText: "#111827",
  accent: "#c41e3a",
  accentHover: "#9b1830",
  fontFamily: "plusJakarta",
  headingFontFamily: "fraunces",
  fontWeight: 400,
  headingFontWeight: 700,
  textTransform: "none",
  headingTransform: "none",
  italic: false,
  headingItalic: false,
  underline: false,
  headingUnderline: false,
  shadowEnabled: false,
  shadowX: 0,
  shadowY: 1,
  shadowBlur: 2,
  shadowColor: "rgba(0,0,0,0.18)",
};

const BODY_MIN = 12;
const BODY_MAX = 24;
const LETTER_MIN = -2;
const LETTER_MAX = 5;
const LH_MIN = 1;
const LH_MAX = 2.5;
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

function num(value: unknown, fallback: number, min?: number, max?: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  let out = n;
  if (min != null) out = Math.max(min, out);
  if (max != null) out = Math.min(max, out);
  return out;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parseTypography(raw: unknown): TypographySettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TYPOGRAPHY };
  const o = raw as Record<string, unknown>;
  const scale = o["scaleRatio"];
  const family = o["fontFamily"];
  const headingFamily = o["headingFontFamily"];
  const transform = o["textTransform"];
  const headingTransform = o["headingTransform"];
  const weight = num(o["fontWeight"], DEFAULT_TYPOGRAPHY.fontWeight, 100, 900);
  const headingWeight = num(o["headingFontWeight"], DEFAULT_TYPOGRAPHY.headingFontWeight, 100, 900);
  return {
    bodySizePx: Math.round(num(o["bodySizePx"], DEFAULT_TYPOGRAPHY.bodySizePx, BODY_MIN, BODY_MAX)),
    h1SizeRem: num(o["h1SizeRem"], DEFAULT_TYPOGRAPHY.h1SizeRem, 0.75, 6),
    h2SizeRem: num(o["h2SizeRem"], DEFAULT_TYPOGRAPHY.h2SizeRem, 0.75, 5),
    h3SizeRem: num(o["h3SizeRem"], DEFAULT_TYPOGRAPHY.h3SizeRem, 0.75, 4),
    h4SizeRem: num(o["h4SizeRem"], DEFAULT_TYPOGRAPHY.h4SizeRem, 0.75, 3),
    scaleRatio:
      typeof scale === "string" && scale in TYPE_SCALE_RATIOS
        ? (scale as TypeScaleRatioKey)
        : DEFAULT_TYPOGRAPHY.scaleRatio,
    letterSpacingPx: num(o["letterSpacingPx"], DEFAULT_TYPOGRAPHY.letterSpacingPx, LETTER_MIN, LETTER_MAX),
    headingLetterSpacingPx: num(
      o["headingLetterSpacingPx"],
      DEFAULT_TYPOGRAPHY.headingLetterSpacingPx,
      LETTER_MIN,
      LETTER_MAX,
    ),
    lineHeight: num(o["lineHeight"], DEFAULT_TYPOGRAPHY.lineHeight, LH_MIN, LH_MAX),
    headingLineHeight: num(o["headingLineHeight"], DEFAULT_TYPOGRAPHY.headingLineHeight, LH_MIN, LH_MAX),
    primaryText: str(o["primaryText"], DEFAULT_TYPOGRAPHY.primaryText),
    mutedText: str(o["mutedText"], DEFAULT_TYPOGRAPHY.mutedText),
    headingText: str(o["headingText"], DEFAULT_TYPOGRAPHY.headingText),
    accent: str(o["accent"], DEFAULT_TYPOGRAPHY.accent),
    accentHover: str(o["accentHover"], DEFAULT_TYPOGRAPHY.accentHover),
    fontFamily:
      typeof family === "string" && family in FONT_FAMILIES
        ? (family as FontFamilyKey)
        : DEFAULT_TYPOGRAPHY.fontFamily,
    headingFontFamily:
      typeof headingFamily === "string" && headingFamily in FONT_FAMILIES
        ? (headingFamily as FontFamilyKey)
        : DEFAULT_TYPOGRAPHY.headingFontFamily,
    fontWeight: (WEIGHTS.includes(Math.round(weight / 100) * 100 as (typeof WEIGHTS)[number])
      ? Math.round(weight / 100) * 100
      : DEFAULT_TYPOGRAPHY.fontWeight) as number,
    headingFontWeight: (WEIGHTS.includes(Math.round(headingWeight / 100) * 100 as (typeof WEIGHTS)[number])
      ? Math.round(headingWeight / 100) * 100
      : DEFAULT_TYPOGRAPHY.headingFontWeight) as number,
    textTransform:
      transform === "uppercase" || transform === "lowercase" || transform === "capitalize" || transform === "none"
        ? transform
        : DEFAULT_TYPOGRAPHY.textTransform,
    headingTransform:
      headingTransform === "uppercase" ||
      headingTransform === "lowercase" ||
      headingTransform === "capitalize" ||
      headingTransform === "none"
        ? headingTransform
        : DEFAULT_TYPOGRAPHY.headingTransform,
    italic: bool(o["italic"], DEFAULT_TYPOGRAPHY.italic),
    headingItalic: bool(o["headingItalic"], DEFAULT_TYPOGRAPHY.headingItalic),
    underline: bool(o["underline"], DEFAULT_TYPOGRAPHY.underline),
    headingUnderline: bool(o["headingUnderline"], DEFAULT_TYPOGRAPHY.headingUnderline),
    shadowEnabled: bool(o["shadowEnabled"], DEFAULT_TYPOGRAPHY.shadowEnabled),
    shadowX: num(o["shadowX"], DEFAULT_TYPOGRAPHY.shadowX, -20, 20),
    shadowY: num(o["shadowY"], DEFAULT_TYPOGRAPHY.shadowY, -20, 20),
    shadowBlur: num(o["shadowBlur"], DEFAULT_TYPOGRAPHY.shadowBlur, 0, 40),
    shadowColor: str(o["shadowColor"], DEFAULT_TYPOGRAPHY.shadowColor),
  };
}

export function applyTypeScale(bodySizePx: number, ratioKey: TypeScaleRatioKey): Pick<
  TypographySettings,
  "h1SizeRem" | "h2SizeRem" | "h3SizeRem" | "h4SizeRem"
> {
  const r = TYPE_SCALE_RATIOS[ratioKey].ratio;
  const bodyRem = bodySizePx / 16;
  return {
    h4SizeRem: roundRem(bodyRem * r),
    h3SizeRem: roundRem(bodyRem * r * r),
    h2SizeRem: roundRem(bodyRem * r * r * r),
    h1SizeRem: roundRem(bodyRem * r * r * r * r),
  };
}

function roundRem(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function typographyToCssVars(t: TypographySettings): Record<string, string> {
  const body = FONT_FAMILIES[t.fontFamily]?.stack ?? FONT_FAMILIES.system.stack;
  const heading = FONT_FAMILIES[t.headingFontFamily]?.stack ?? body;
  const shadow = t.shadowEnabled
    ? `${t.shadowX}px ${t.shadowY}px ${t.shadowBlur}px ${t.shadowColor}`
    : "none";
  return {
    "--font-main": body,
    "--font-heading": heading,
    "--text-primary": t.primaryText,
    "--text-muted": t.mutedText,
    "--text-heading": t.headingText,
    "--text-accent": t.accent,
    "--text-accent-hover": t.accentHover,
    "--body-size": `${t.bodySizePx / 16}rem`,
    "--h1-size": `${t.h1SizeRem}rem`,
    "--h2-size": `${t.h2SizeRem}rem`,
    "--h3-size": `${t.h3SizeRem}rem`,
    "--h4-size": `${t.h4SizeRem}rem`,
    "--letter-spacing": `${t.letterSpacingPx}px`,
    "--heading-letter-spacing": `${t.headingLetterSpacingPx}px`,
    "--line-height": String(t.lineHeight),
    "--heading-line-height": String(t.headingLineHeight),
    "--font-weight": String(t.fontWeight),
    "--heading-font-weight": String(t.headingFontWeight),
    "--text-transform": t.textTransform,
    "--heading-transform": t.headingTransform,
    "--font-style": t.italic ? "italic" : "normal",
    "--heading-style": t.headingItalic ? "italic" : "normal",
    "--text-decoration": t.underline ? "underline" : "none",
    "--heading-decoration": t.headingUnderline ? "underline" : "none",
    "--text-shadow": shadow,
  };
}

export function applyTypographyCss(t: TypographySettings, target: HTMLElement = document.documentElement): void {
  const vars = typographyToCssVars(t);
  for (const key of Object.keys(vars)) {
    target.style.setProperty(key, vars[key] as string);
  }
  // Tailwind semantik tokenları da metin paletini izlesin; düğme zemin renklerine dokunulmaz.
  if (target === document.documentElement) {
    target.style.setProperty("--foreground", t.primaryText);
    target.style.setProperty("--card-foreground", t.primaryText);
    target.style.setProperty("--popover-foreground", t.primaryText);
    target.style.setProperty("--muted-foreground", t.mutedText);
    target.style.setProperty("--sidebar-foreground", t.primaryText);
  }
  loadGoogleFont(t.fontFamily);
  if (t.headingFontFamily !== t.fontFamily) loadGoogleFont(t.headingFontFamily);
}

const loadedFonts = new Set<string>();

export function loadGoogleFont(key: FontFamilyKey): void {
  if (typeof document === "undefined") return;
  const spec = FONT_FAMILIES[key];
  if (!spec?.google || loadedFonts.has(key)) return;
  const id = `silvan-gf-${key}`;
  if (document.getElementById(id)) {
    loadedFonts.add(key);
    return;
  }
  loadedFonts.add(key);
  const href = `https://fonts.googleapis.com/css2?family=${spec.google}&display=swap`;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  link.crossOrigin = "anonymous";
  link.media = "print";
  link.onload = () => {
    link.media = "all";
  };
  link.onerror = () => {
    loadedFonts.delete(key);
    link.remove();
  };
  document.head.appendChild(link);
}

function parseColorToRgb(input: string): { r: number; g: number; b: number; a: number } | null {
  const s = input.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (hex) {
    let h = hex[1] as string;
    if (h.length === 3) h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    if (h.length === 4) h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(s);
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] != null ? Number(rgba[4]) : 1,
    };
  }
  const hsla = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(s);
  if (hsla) {
    const rgb = hslToRgb(Number(hsla[1]), Number(hsla[2]) / 100, Number(hsla[3]) / 100);
    return { ...rgb, a: hsla[4] != null ? Number(hsla[4]) : 1 };
  }
  return null;
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

export function toHex(r: number, g: number, b: number, a = 1): string {
  const hr = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  const hex = `#${hr(r)}${hr(g)}${hr(b)}`;
  if (a >= 0.999) return hex;
  return `${hex}${hr(a * 255)}`;
}

export function decomposeColor(input: string): { hex: string; r: number; g: number; b: number; a: number; h: number; s: number; l: number } {
  const rgb = parseColorToRgb(input) ?? { r: 26, g: 26, b: 26, a: 1 };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return {
    hex: toHex(rgb.r, rgb.g, rgb.b, rgb.a),
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    a: rgb.a,
    h: Math.round(hsl.h),
    s: Math.round(hsl.s * 100),
    l: Math.round(hsl.l * 100),
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export type ContrastGrade = "fail" | "AA" | "AAA";

export function contrastRatio(fg: string, bg: string): { ratio: number; body: ContrastGrade; large: ContrastGrade } {
  const a = parseColorToRgb(fg);
  const b = parseColorToRgb(bg);
  if (!a || !b) return { ratio: 0, body: "fail", large: "fail" };
  const L1 = relativeLuminance(a.r, a.g, a.b);
  const L2 = relativeLuminance(b.r, b.g, b.b);
  const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  const rounded = Math.round(ratio * 100) / 100;
  const body: ContrastGrade = rounded >= 7 ? "AAA" : rounded >= 4.5 ? "AA" : "fail";
  const large: ContrastGrade = rounded >= 4.5 ? "AAA" : rounded >= 3 ? "AA" : "fail";
  return { ratio: rounded, body, large };
}

export const FONT_WEIGHT_LABELS: Record<number, string> = {
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semi Bold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
};

export const FONT_WEIGHTS = WEIGHTS;

export function isTypographyConfigured(raw: unknown): boolean {
  return Boolean(raw && typeof raw === "object" && Object.keys(raw as object).length > 0);
}

export function isMissingColumnError(
  error: { message?: string; code?: string } | null | undefined,
  column: string,
): boolean {
  if (!error) return false;
  const msg = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  const col = column.toLowerCase();
  if (!msg.includes(col)) return false;
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find") ||
    error.code === "PGRST204" ||
    error.code === "42703"
  );
}

export const SITE_SETTINGS_BASE_COLUMNS =
  "id, brand_name, primary_color, accent_color, secondary_color, background_color, logo_url, favicon_url, banner_url, theme_mode, layout_variant, hero_badge, hero_title, hero_title_accent, hero_subtitle";

export const SITE_SETTINGS_COLUMNS_WITH_TYPOGRAPHY = `${SITE_SETTINGS_BASE_COLUMNS}, typography`;

export const SITE_SETTINGS_COLUMNS_FULL = `${SITE_SETTINGS_COLUMNS_WITH_TYPOGRAPHY}, hero_banners`;
