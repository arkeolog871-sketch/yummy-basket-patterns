/**
 * Renk matematiği — OKLab / OKLCH (Björn Ottosson), sRGB ve Display P3.
 *
 * OKLCH'de aynı L değerindeki renkler göze eşit parlak görünür; bu yüzden
 * okunaklılık tondan bağımsız ayarlanabilir. Kategori renkleri
 * (category-colors.ts) ve site teması (theme-palette.ts) buradan hesaplanır.
 */

export type Rgb = [number, number, number];
export type Lab = [number, number, number];
export type Gamut = "srgb" | "p3";

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255) as Rgb;
}

export function rgbToHex(rgb: Rgb): string {
  return `#${rgb
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB (gama) → OKLab. */
export function rgbToOklab(rgb: Rgb): Lab {
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

/** OKLCH → DOĞRUSAL sRGB (kırpılmaz; kapsam dışı değerler 0..1 dışına taşar). */
export function oklchToLinearSrgb(lightness: number, chroma: number, hueDeg: number): Rgb {
  const hue = (hueDeg * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLCH → gama sRGB (kırpılmaz). */
export function oklchToRgb(lightness: number, chroma: number, hueDeg: number): Rgb {
  return oklchToLinearSrgb(lightness, chroma, hueDeg).map(toGamma) as Rgb;
}

/** Doğrusal sRGB → doğrusal Display P3. */
function linearSrgbToLinearP3([r, g, b]: Rgb): Rgb {
  return [
    0.8224621 * r + 0.177538 * g,
    0.0331941 * r + 0.9668058 * g,
    0.0170827 * r + 0.0723974 * g + 0.9105199 * b,
  ];
}

const EPS = 1e-4;
const within = (rgb: Rgb) => rgb.every((c) => c >= -EPS && c <= 1 + EPS);

export function inGamut(lightness: number, chroma: number, hue: number, gamut: Gamut): boolean {
  const linear = oklchToLinearSrgb(lightness, chroma, hue);
  return within(gamut === "srgb" ? linear : linearSrgbToLinearP3(linear));
}

/** Verilen L ve tonda, kapsama sığan en yüksek doygunluk (üst sınır `cap`). */
export function maxChroma(lightness: number, hue: number, gamut: Gamut, cap = 0.4): number {
  if (inGamut(lightness, cap, hue, gamut)) return cap;
  let low = 0;
  let high = cap;
  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2;
    if (inGamut(lightness, mid, hue, gamut)) low = mid;
    else high = mid;
  }
  return low;
}

export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  return rgbToHex(oklchToRgb(lightness, chroma, hue));
}

export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const [l, a, b] = rgbToOklab(hexToRgb(hex));
  const c = Math.hypot(a, b);
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { l, c, h };
}

/** Göreli parlaklık (WCAG). Doğrusal değerler kırpılmadan kullanılır: P3 renkleri için de doğru. */
export function relativeLuminanceLinear([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function luminanceOfHex(hex: string): number {
  return relativeLuminanceLinear(hexToRgb(hex).map(toLinear) as Rgb);
}

export function luminanceOfOklch(lightness: number, chroma: number, hue: number): number {
  return relativeLuminanceLinear(oklchToLinearSrgb(lightness, chroma, hue));
}

export function contrastFromLuminance(first: number, second: number): number {
  const [high, low] = first > second ? [first, second] : [second, first];
  return (high + 0.05) / (low + 0.05);
}

export function contrastRatio(foreground: string, background: string): number {
  return contrastFromLuminance(luminanceOfHex(foreground), luminanceOfHex(background));
}
