/**
 * Site teması — TEK TOHUMDAN türetilen, okunaklılığı garanti edilen renkler.
 *
 * NEDEN (ölçüldü, 23 Eylül 2026): kurucu panelinde 5 serbest renk alanı
 * vardı ve hiçbir denetim yoktu. Canlıda üçü (vurgu, ikincil, arka plan)
 * aynı krem #f4edda seçilmişti: ikincil tuşlar zeminden ayrışmıyordu (1.0:1),
 * vurgu rengini kullanan simgeler görünmüyordu. Ana renk #ff4040 çok açıktı;
 * beyaz yazı taşıyamıyordu (3.5:1). Üstelik logodaki amblem derin kadife
 * bordo (#8f1129) ve altın (#e9ca93) iken arayüz domates kırmızısıydı.
 *
 * YÖNTEM: kurucu yalnızca bir TOHUM seçer: ton (0–360) ve cesaret
 * (doygunluk, 0.25–1). Bütün roller bundan OKLCH'de üretilir:
 *  - ana renk: tohum tonu, derin (L≈0.44), beyaz yazı taşır;
 *  - vurgu (altın): tohum tonu + 58°, açık (L≈0.82), koyu yazı taşır;
 *  - nötrler: vurgu tonuna çekilmiş kremler; zemin logonun kremi.
 * Her yazı/zemin çifti en az 4.5:1'e ZORLANIR: yetmezse yazı ya da zemin
 * koyulaştırılır/açılır. Yani hangi tohum seçilirse seçilsin tema okunaklı.
 *
 * GENİŞ RENK: ekran Display P3 destekliyorsa ana renk ve vurgu aynı
 * parlaklıkta daha doygun üretilir (okunaklılık değişmez, renk canlanır).
 */
import {
  contrastFromLuminance,
  hexToOklch,
  luminanceOfOklch,
  maxChroma,
  oklchToHex,
  type Gamut,
} from "./color-math";

export type BrandSeed = { hue: number; boldness: number };

export const MIN_TEXT_CONTRAST = 4.5;
/** Simge, çerçeve gibi yazı olmayan öğeler için alt sınır (WCAG 1.4.11). */
export const MIN_UI_CONTRAST = 3;

/** Logonun zemini: başlıktaki amblem bu kremin üstünde basılı. */
const LOGO_CREAM = "#f4edda";
/** Amblemin kadife bordosu (logo-mark.png, parlak pelerin bölgesi). */
export const EMBLEM_CRIMSON = "#8f1129";

const PRIMARY_L = 0.44;
const ACCENT_L = 0.82;
const ACCENT_HUE_SHIFT = 58;
const PRIMARY_CHROMA_CAP = 0.22;
const ACCENT_CHROMA_CAP = 0.14;
const BOLDNESS_MIN = 0.25;

const wrapHue = (hue: number) => ((hue % 360) + 360) % 360;
const clampBoldness = (value: number) => Math.min(1, Math.max(BOLDNESS_MIN, value));

type Oklch = { l: number; c: number; h: number };

const css = ({ l, c, h }: Oklch) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
const hex = ({ l, c, h }: Oklch) => oklchToHex(l, c, h);
const lum = ({ l, c, h }: Oklch) => luminanceOfOklch(l, c, h);
export const contrastOf = (a: Oklch, b: Oklch) => contrastFromLuminance(lum(a), lum(b));

/** Tohumdan, sRGB'de temsil edilen tek bir renk (veritabanında saklanır). */
export function seedToHex(seed: BrandSeed): string {
  const hue = wrapHue(seed.hue);
  const chroma =
    clampBoldness(seed.boldness) * maxChroma(PRIMARY_L, hue, "srgb", PRIMARY_CHROMA_CAP);
  return oklchToHex(PRIMARY_L, chroma, hue);
}

/** Saklanan renkten tohumu geri çıkarır: ton aynen, cesaret = doygunluk / sığan en yüksek. */
export function seedFromHex(value: string): BrandSeed {
  if (!/^#[0-9a-f]{6}$/i.test(value)) return EMBLEM_SEED;
  const { c, h } = hexToOklch(value);
  if (c < 0.02) return { hue: EMBLEM_SEED.hue, boldness: BOLDNESS_MIN };
  const limit = maxChroma(PRIMARY_L, h, "srgb", PRIMARY_CHROMA_CAP);
  return { hue: Math.round(h * 10) / 10, boldness: clampBoldness(limit > 0 ? c / limit : 1) };
}

export const EMBLEM_SEED: BrandSeed = (() => {
  const { h } = hexToOklch(EMBLEM_CRIMSON);
  return { hue: Math.round(h * 10) / 10, boldness: 0.85 };
})();

/**
 * `fg`, `bg` üstünde en az `min` okunaklılığa ulaşana dek koyulaşır/açılır.
 * Zemin açıksa yazı koyulaşır, koyuysa açılır.
 */
function ensureText(fg: Oklch, bg: Oklch, min = MIN_TEXT_CONTRAST): Oklch {
  const darken = lum(bg) > 0.18;
  let current = fg;
  for (let step = 0; step < 100 && contrastOf(current, bg) < min; step += 1) {
    current = { ...current, l: Math.min(1, Math.max(0, current.l + (darken ? -0.01 : 0.01))) };
  }
  return current;
}

/** Zemin rengini (yazı sabitken) okunaklılık sağlanana dek yazıdan uzaklaştırır. */
function ensureSurface(bg: Oklch, fg: Oklch, min = MIN_TEXT_CONTRAST): Oklch {
  const lighten = lum(fg) < 0.18;
  let current = bg;
  for (let step = 0; step < 100 && contrastOf(fg, current) < min; step += 1) {
    const l = Math.min(1, Math.max(0, current.l + (lighten ? 0.01 : -0.01)));
    current = { ...current, l, c: Math.min(current.c, maxChroma(l, current.h, "srgb")) };
  }
  return current;
}

export type ThemeRoles = {
  background: Oklch;
  foreground: Oklch;
  card: Oklch;
  primary: Oklch;
  primaryForeground: Oklch;
  secondary: Oklch;
  secondaryForeground: Oklch;
  muted: Oklch;
  mutedForeground: Oklch;
  accent: Oklch;
  accentForeground: Oklch;
  border: Oklch;
};

export function buildThemeRoles(seed: BrandSeed, gamut: Gamut = "srgb"): ThemeRoles {
  const hue = wrapHue(seed.hue);
  const accentHue = wrapHue(hue + ACCENT_HUE_SHIFT);
  const boldness = clampBoldness(seed.boldness);

  const cream = hexToOklch(LOGO_CREAM);
  const background: Oklch = { l: cream.l, c: cream.c, h: cream.h };
  const card: Oklch = { l: 1, c: 0, h: 0 };
  const white: Oklch = { l: 1, c: 0, h: 0 };

  let foreground: Oklch = { l: 0.24, c: 0.03, h: hue };
  foreground = ensureText(ensureText(foreground, background), card);

  // Ana renk: beyaz yazı taşıyacak kadar derin.
  const primaryChroma = boldness * maxChroma(PRIMARY_L, hue, gamut, PRIMARY_CHROMA_CAP);
  let primary: Oklch = { l: PRIMARY_L, c: primaryChroma, h: hue };
  primary = ensureSurface(primary, white);
  const primaryForeground = white;

  // Vurgu (altın): açık, koyu yazı taşır.
  const accentChroma = boldness * maxChroma(ACCENT_L, accentHue, gamut, ACCENT_CHROMA_CAP);
  const accent: Oklch = { l: ACCENT_L, c: accentChroma, h: accentHue };
  const accentForeground = ensureText({ l: 0.27, c: 0.06, h: hue }, accent);

  const secondary: Oklch = { l: 0.905, c: 0.035, h: accentHue };
  const secondaryForeground = ensureText({ l: 0.3, c: 0.05, h: hue }, secondary);

  const muted: Oklch = { l: 0.93, c: 0.025, h: accentHue };
  let mutedForeground: Oklch = { l: 0.47, c: 0.04, h: hue };
  for (const surface of [background, card, muted, secondary]) {
    mutedForeground = ensureText(mutedForeground, surface);
  }

  const border: Oklch = { l: 0.86, c: 0.035, h: accentHue };

  return {
    background,
    foreground,
    card,
    primary,
    primaryForeground,
    secondary,
    secondaryForeground,
    muted,
    mutedForeground,
    accent,
    accentForeground,
    border,
  };
}

/** CSS değişkenleri (useSiteSettings sayfanın köküne yazar). */
export function themeCssVariables(seed: BrandSeed, gamut: Gamut = "srgb"): Record<string, string> {
  const r = buildThemeRoles(seed, gamut);
  const primaryGlow: Oklch = { l: 0.55, c: r.primary.c, h: wrapHue(r.primary.h + 12) };
  return {
    "--background": css(r.background),
    "--foreground": css(r.foreground),
    "--card": css(r.card),
    "--card-foreground": css(r.foreground),
    "--popover": css(r.card),
    "--popover-foreground": css(r.foreground),
    "--primary": css(r.primary),
    "--primary-foreground": css(r.primaryForeground),
    "--ring": css(r.primary),
    "--secondary": css(r.secondary),
    "--secondary-foreground": css(r.secondaryForeground),
    "--muted": css(r.muted),
    "--muted-foreground": css(r.mutedForeground),
    "--accent": css(r.accent),
    "--accent-foreground": css(r.accentForeground),
    "--warm": css(r.accent),
    "--warm-foreground": css(r.accentForeground),
    "--border": css(r.border),
    "--input": css(r.border),
    "--sidebar": css(r.muted),
    "--sidebar-foreground": css(r.foreground),
    "--sidebar-primary": css(r.primary),
    "--sidebar-primary-foreground": css(r.primaryForeground),
    "--sidebar-accent": css(r.accent),
    "--sidebar-accent-foreground": css(r.accentForeground),
    "--sidebar-border": css(r.border),
    "--sidebar-ring": css(r.primary),
    "--gradient-warm": `linear-gradient(120deg, ${css(r.primary)} 0%, ${css(primaryGlow)} 100%)`,
    "--gradient-hero": `linear-gradient(145deg, ${css(r.background)} 0%, ${css(r.accent)} 100%)`,
  };
}

/**
 * Veritabanındaki 5 eski renk sütunu için sRGB karşılıkları. Tohum
 * `primary_color`'da saklanır; diğerleri türetilmiş değerdir (eski kod ve
 * yazı paneli önizlemesi okuyabilsin diye).
 */
export function themeHexColumns(seed: BrandSeed) {
  const r = buildThemeRoles(seed, "srgb");
  return {
    primary_color: seedToHex(seed),
    accent_color: hex(r.accent),
    secondary_color: hex(r.secondary),
    background_color: hex(r.background),
    warm_color: hex(r.accent),
  };
}

/** Test ve panel önizlemesi için: denetlenen bütün yazı/zemin çiftleri. */
export function themeContrastReport(seed: BrandSeed, gamut: Gamut = "srgb") {
  const r = buildThemeRoles(seed, gamut);
  const text: Array<[string, Oklch, Oklch]> = [
    ["gövde yazısı / zemin", r.foreground, r.background],
    ["gövde yazısı / kart", r.foreground, r.card],
    ["soluk yazı / zemin", r.mutedForeground, r.background],
    ["soluk yazı / kart", r.mutedForeground, r.card],
    ["soluk yazı / soluk zemin", r.mutedForeground, r.muted],
    ["ana tuş yazısı", r.primaryForeground, r.primary],
    ["ikincil tuş yazısı", r.secondaryForeground, r.secondary],
    ["vurgu yazısı", r.accentForeground, r.accent],
  ];
  const ui: Array<[string, Oklch, Oklch]> = [["ana renk simgesi / zemin", r.primary, r.background]];
  return {
    text: text.map(([name, fg, bg]) => ({ name, ratio: contrastOf(fg, bg) })),
    ui: ui.map(([name, fg, bg]) => ({ name, ratio: contrastOf(fg, bg) })),
  };
}
