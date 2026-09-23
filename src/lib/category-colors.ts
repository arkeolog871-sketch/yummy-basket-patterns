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

type Rgb = [number, number, number];
type Lab = [number, number, number];

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

function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255) as Rgb;
}

function rgbToHex(rgb: Rgb): string {
  return `#${rgb
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB → OKLab (Björn Ottosson). */
function rgbToOklab(rgb: Rgb): Lab {
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLCH → doğrusal olmayan sRGB (kanallar 0..1 dışına taşabilir). */
function oklchToRgb(lightness: number, chroma: number, hueDeg: number): Rgb {
  const hue = (hueDeg * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

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

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const [high, low] = [luminance(foreground), luminance(background)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (high + 0.05) / (low + 0.05);
}

/** Seçili olmayan çipin zemini: krem üstüne %10 renk. */
export function chipTint(color: string, background = CATEGORY_CHIP_BACKGROUND): string {
  const fg = hexToRgb(color);
  const bg = hexToRgb(background);
  return rgbToHex(fg.map((c, index) => TINT_ALPHA * c + (1 - TINT_ALPHA) * bg[index]!) as Rgb);
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
