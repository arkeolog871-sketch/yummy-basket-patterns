/**
 * Kategori renkleri — OTOMATİK, elle seçilmez.
 *
 * YÖNTEM ("en uzak renk", kullanıcı seçimi): yeni kategori eklendiğinde,
 * mevcut bütün kategori renklerine GÖZLE ALGILANAN uzaklığı en büyük olan
 * aday renk verilir ve kalıcı olarak saklanır. Var olan kategorilerin rengi
 * hiç değişmez; sıra değişikliği rengi etkilemez.
 *
 * NEDEN: elle seçimde (ölçüldü, 23 Eylül 2026) 14 kategoriden üç tanesi aynı
 * maviyi, ikişer tanesi aynı moru ve bordoyu paylaşıyordu; 12 kategorinin
 * çip yazısı okunaklılık alt sınırının (4.5:1) altındaydı, Market 1.5:1.
 *
 * Adaylar OKLCH uzayında üretilir: aynı L değerindeki renkler göze eşit
 * parlak görünür, bu yüzden okunaklılık tondan bağımsız ayarlanabilir.
 * Yalnızca çipin iki hâlinde de 4.5:1'i geçen adaylar listeye girer:
 *  - seçili: renk zemin, beyaz yazı;
 *  - seçili değil: krem zemin üstünde %10 renk tonu, renkli yazı.
 */

import {
  contrastRatio,
  hexToOklch,
  hexToRgb,
  luminanceOfHex,
  maxChroma,
  oklchToHex,
  oklchToRgb,
  rgbToHex,
  rgbToOklab,
  type Lab,
  type Rgb,
} from "./color-math";

export { contrastRatio };

/** Sayfanın açık tema zemini (kurucu panelindeki varsayılan). */
export const CATEGORY_CHIP_BACKGROUND = "#f4edda";
/** Seçili olmayan çipte rengin zemine karışma oranı (index.tsx: `${color}1a`). */
const TINT_ALPHA = 0x1a / 255;
export const MIN_CONTRAST = 4.5;

const LIGHTNESS_LEVELS = [0.49, 0.41];
const TARGET_CHROMA = 0.17;
const HUE_STEP = 2;
/** İlk kategori (hiç renk yokken) sıcak kırmızıya yakın başlar. */
const START_HUE = 25;

const inGamut = (rgb: Rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/** Ekranın gösterebildiği en doygun hâl: doygunluk, renk sRGB'ye sığana dek kısılır. */
function gamutMapped(lightness: number, hue: number): string {
  let low = 0;
  let high = TARGET_CHROMA;
  if (inGamut(oklchToRgb(lightness, high, hue))) return rgbToHex(oklchToRgb(lightness, high, hue));
  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToRgb(lightness, mid, hue))) low = mid;
    else high = mid;
  }
  return rgbToHex(oklchToRgb(lightness, low, hue));
}

/** Seçili olmayan çipin zemini: krem üstüne %10 renk. */
export function chipTint(color: string, background = CATEGORY_CHIP_BACKGROUND): string {
  const fg = hexToRgb(color);
  const bg = hexToRgb(background);
  return rgbToHex(fg.map((c, index) => TINT_ALPHA * c + (1 - TINT_ALPHA) * bg[index]!) as Rgb);
}

/**
 * Seçili olmayan çipin yazı (ve çerçeve) rengi, verilen sayfa zemininde.
 * Açık temada renk zaten okunaklı, aynen döner. Koyu temada (ölçüldü, canlı:
 * 14 çip 1.9–3.0:1) aynı ton, kendi tonu üstünde ≥ 4.5:1 olana dek açılır.
 */
export function categoryChipText(color: string, background: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(color) || !/^#[0-9a-f]{6}$/i.test(background)) return color;
  const lighten = luminanceOfHex(background) < 0.18;
  // Koyu zeminde pay: tarayıcı saydam tonu 8 bitte yuvarlıyor; canlıda
  // Market 4.49:1 ölçüldü (hesap 4.5). Açık temada renkler olduğu gibi kalır.
  const target = lighten ? MIN_CONTRAST + 0.1 : MIN_CONTRAST;
  const readable = (value: string) => contrastRatio(value, chipTint(color, background)) >= target;
  if (readable(color)) return color;
  const { l, c, h } = hexToOklch(color);
  let lightness = l;
  let current = color;
  for (let step = 0; step < 100 && !readable(current); step += 1) {
    lightness = Math.min(1, Math.max(0, lightness + (lighten ? 0.01 : -0.01)));
    current = oklchToHex(lightness, Math.min(c, maxChroma(lightness, h, "srgb")), h);
  }
  return current;
}

/** Çipin iki hâlinde de okunaklı mı? */
export function isReadableCategoryColor(color: string): boolean {
  return (
    contrastRatio("#ffffff", color) >= MIN_CONTRAST &&
    contrastRatio(color, chipTint(color)) >= MIN_CONTRAST
  );
}

type Candidate = { hex: string; lab: Lab; hue: number };

let candidateCache: Candidate[] | null = null;

/**
 * Aday renkler, sabit sırada: ton START_HUE'den başlayarak döner, her tonda
 * önce açık sonra koyu seviye. Sabit sıra = eşitlikte hep aynı sonuç.
 */
export function categoryColorCandidates(): Candidate[] {
  if (candidateCache) return candidateCache;
  const list: Candidate[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < 360; offset += HUE_STEP) {
    const hue = (START_HUE + offset) % 360;
    for (const lightness of LIGHTNESS_LEVELS) {
      const hex = gamutMapped(lightness, hue);
      if (seen.has(hex) || !isReadableCategoryColor(hex)) continue;
      seen.add(hex);
      list.push({ hex, lab: rgbToOklab(hexToRgb(hex)), hue });
    }
  }
  candidateCache = list;
  return list;
}

/** İki renk arasındaki algısal uzaklık (OKLab, Öklid). */
export function perceptualDistance(first: string, second: string): number {
  const a = rgbToOklab(hexToRgb(first));
  const b = rgbToOklab(hexToRgb(second));
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Yeni kategori için renk: mevcut renklerin HER BİRİNE olan en küçük uzaklığı
 * en büyük olan aday. Geçersiz/boş mevcut renkler yok sayılır.
 */
export function pickCategoryColor(existing: ReadonlyArray<string | null | undefined>): string {
  const candidates = categoryColorCandidates();
  const taken = existing
    .filter((color): color is string => typeof color === "string" && HEX.test(color))
    .map((color) => rgbToOklab(hexToRgb(color)));
  if (taken.length === 0) return candidates[0]!.hex;

  let best = candidates[0]!;
  let bestScore = -1;
  for (const candidate of candidates) {
    let nearest = Infinity;
    for (const lab of taken) {
      const distance = Math.hypot(
        candidate.lab[0] - lab[0],
        candidate.lab[1] - lab[1],
        candidate.lab[2] - lab[2],
      );
      if (distance < nearest) nearest = distance;
    }
    // Kesin büyük: eşitlikte sıradaki ilk aday kalır (belirlenimci).
    if (nearest > bestScore + 1e-9) {
      bestScore = nearest;
      best = candidate;
    }
  }
  return best.hex;
}

/** Sıfırdan sırayla renk dağıtımı (ilk kurulumda mevcut kategoriler için). */
export function assignCategoryColors(count: number): string[] {
  const colors: string[] = [];
  for (let index = 0; index < count; index += 1) colors.push(pickCategoryColor(colors));
  return colors;
}
