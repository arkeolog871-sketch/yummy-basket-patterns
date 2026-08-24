export const TEXT_PREFS_STORAGE_KEY = "silvan-text-prefs";

export const TEXT_SIZES = ["sm", "md", "lg"] as const;
export const TEXT_FONTS = ["sans", "serif", "mono", "system"] as const;
export const TEXT_CONTRASTS = ["default", "high", "custom"] as const;

export type TextSize = (typeof TEXT_SIZES)[number];
export type TextFont = (typeof TEXT_FONTS)[number];
export type TextContrast = (typeof TEXT_CONTRASTS)[number];

export type TextPrefs = {
  size: TextSize;
  font: TextFont;
  contrast: TextContrast;
  customColor: string;
};

export const DEFAULT_TEXT_PREFS: TextPrefs = {
  size: "md",
  font: "sans",
  contrast: "default",
  customColor: "#2a241c",
};

const SIZE_SET = new Set<string>(TEXT_SIZES);
const FONT_SET = new Set<string>(TEXT_FONTS);
const CONTRAST_SET = new Set<string>(TEXT_CONTRASTS);

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function parseTextPrefs(raw: unknown): TextPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TEXT_PREFS };
  const row = raw as Record<string, unknown>;
  const size = String(row["size"] ?? "");
  const font = String(row["font"] ?? "");
  const contrast = String(row["contrast"] ?? "");
  const customColor = row["customColor"];
  return {
    size: SIZE_SET.has(size) ? (size as TextSize) : DEFAULT_TEXT_PREFS.size,
    font: FONT_SET.has(font) ? (font as TextFont) : DEFAULT_TEXT_PREFS.font,
    contrast: CONTRAST_SET.has(contrast) ? (contrast as TextContrast) : DEFAULT_TEXT_PREFS.contrast,
    customColor:
      typeof customColor === "string" && isHexColor(customColor)
        ? customColor
        : DEFAULT_TEXT_PREFS.customColor,
  };
}

function prefersHighContrast(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-contrast: more)").matches;
  } catch {
    return false;
  }
}

export function readTextPrefs(): TextPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_TEXT_PREFS };
  try {
    const stored = window.localStorage.getItem(TEXT_PREFS_STORAGE_KEY);
    if (stored) return parseTextPrefs(JSON.parse(stored));
  } catch {
    /* bozuk kayıt → varsayılan */
  }
  if (prefersHighContrast()) {
    return { ...DEFAULT_TEXT_PREFS, contrast: "high" };
  }
  return { ...DEFAULT_TEXT_PREFS };
}

export function persistTextPrefs(prefs: TextPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEXT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* kota / gizli mod */
  }
}

/** Yalnızca tarayıcıda; SSR HTML'ine attribute yazılmaz. */
export function applyTextPrefs(prefs: TextPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const next = parseTextPrefs(prefs);
  root.style.setProperty("--app-font-size", sizeToCss(next.size));
  root.style.setProperty("--app-font-family", fontToCss(next.font));
  root.style.setProperty("--app-heading-family", headingToCss(next.font));
  root.style.setProperty("--app-custom-text-color", next.customColor);
  root.dataset["appFontSize"] = next.size;
  root.dataset["appFont"] = next.font;
  root.dataset["appContrast"] = next.contrast;
}

function sizeToCss(size: TextSize): string {
  if (size === "sm") return "87.5%";
  if (size === "lg") return "112.5%";
  return "100%";
}

function fontToCss(font: TextFont): string {
  if (font === "serif") return 'var(--font-display, "Georgia", serif)';
  if (font === "mono") return "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  if (font === "system") return 'system-ui, -apple-system, "Segoe UI", sans-serif';
  return 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)';
}

function headingToCss(font: TextFont): string {
  if (font === "sans") return 'var(--font-display, "Georgia", serif)';
  return fontToCss(font);
}
