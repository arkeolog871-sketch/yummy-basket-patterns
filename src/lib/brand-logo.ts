/**
 * Yerleşik amblem dosyası krem zeminli (logo-mark.png): açılış ekranı krem
 * olduğu için orada o kullanılır. Başlıkta zemini saydam sürümü gösterilir;
 * koyu temada amblem krem bir kutu içinde görünmesin diye.
 *
 * Saydam sürüm logo-mark.png'den kesildi: krem zemin ve pelerinin gölgesi
 * yarı saydam koyuya çevrildi, amblemin kendisi aynen korundu. Başlık en
 * fazla 64 CSS px genişlikte gösterdiği için 256 px yeterli (3x ekran).
 */
export const DEFAULT_LOGO = "/logo-mark.png";
export const DEFAULT_LOGO_TRANSPARENT = "/logo-mark-transparent.png";

/** Kurucu kendi logosunu yüklediyse o aynen kullanılır. */
export function brandLogoSrc(url: string): string {
  return url === DEFAULT_LOGO ? DEFAULT_LOGO_TRANSPARENT : url;
}
