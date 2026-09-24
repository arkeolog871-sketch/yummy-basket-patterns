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

/**
 * Kaydı olmayan herkes için: Küçük yazı, Sistem yazı tipi, Yüksek karşıtlık
 * (kurucunun seçtiği ana sayfa görünümü). Ayarı kaydetmiş kullanıcı kendi
 * seçimini korur; "Varsayılana dön" buraya döner.
 */
export const DEFAULT_TEXT_PREFS: TextPrefs = {
  size: "sm",
  font: "system",
  contrast: "high",
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

/**
 * <head>'de React'ten önce çalışır: kayıtlı ya da varsayılan ayarı ilk
 * boyamadan önce uygular. Yoksa sayfa bir an Normal boyutta görünüp sonra
 * küçülür (varsayılan artık Küçük olduğu için herkeste olurdu).
 * Mantık readTextPrefs + applyTextPrefs ile aynı; hata olursa sessizce
 * geçer ve React tarafındaki uygulama yine çalışır.
 */
export function textPrefsInlineScript(): string {
  const sizes = Object.fromEntries(TEXT_SIZES.map((size) => [size, sizeToCss(size)]));
  const fonts = Object.fromEntries(
    TEXT_FONTS.map((font) => [font, [fontToCss(font), headingToCss(font)]]),
  );
  return `try{var d=${JSON.stringify(DEFAULT_TEXT_PREFS)},S=${JSON.stringify(sizes)},F=${JSON.stringify(fonts)},C=${JSON.stringify(TEXT_CONTRASTS)},p={size:d.size,font:d.font,contrast:d.contrast,customColor:d.customColor},r=null;try{r=localStorage.getItem(${JSON.stringify(TEXT_PREFS_STORAGE_KEY)})}catch(e){}var o=null;try{o=r?JSON.parse(r):null}catch(e){}if(o&&typeof o==="object"){if(S.hasOwnProperty(o.size))p.size=o.size;if(F.hasOwnProperty(o.font))p.font=o.font;if(C.indexOf(o.contrast)>=0)p.contrast=o.contrast;if(typeof o.customColor==="string"&&/^#[0-9a-fA-F]{6}$/.test(o.customColor))p.customColor=o.customColor}else if(window.matchMedia&&window.matchMedia("(prefers-contrast: more)").matches)p.contrast="high";var h=document.documentElement,st=h.style;st.setProperty("--app-font-size",S[p.size]);st.setProperty("--app-font-family",F[p.font][0]);st.setProperty("--app-heading-family",F[p.font][1]);st.setProperty("--app-custom-text-color",p.customColor);h.setAttribute("data-app-font-size",p.size);h.setAttribute("data-app-font",p.font);h.setAttribute("data-app-contrast",p.contrast)}catch(e){}`;
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
  return "var(--font-sans, ui-sans-serif, system-ui, sans-serif)";
}

function headingToCss(font: TextFont): string {
  if (font === "sans") return 'var(--font-display, "Georgia", serif)';
  return fontToCss(font);
}
