const DARK_ON_WARM = "oklch(0.331 0.038 52)";
const LIGHT_ON_WARM = "oklch(0.98 0.01 78)";

/**
 * `--warm` kurucu panelindeki marka renginden geliyor, ama `--warm-foreground`
 * styles.css'teki varsayılanda (açık krem zemin için koyu kahve) kalıyordu.
 * Koyu ya da doygun bir warm rengi seçildiğinde `bg-warm text-warm-foreground`
 * kullanan her yer okunmaz hâle geliyordu — ör. "Doğrulanmadı" rozeti kırmızı
 * zemin üzerinde koyu kahve yazı.
 *
 * Ön plan artık seçilen renkten türetiliyor. Varsayılan krem (#f3dfc0) için
 * sonuç bugünkü değerle birebir aynı kalır, yani mevcut görünüm değişmez.
 */
export function readableOnWarm(hex: string): string {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return DARK_ON_WARM;
  const linear = (offset: number) => {
    const srgb = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * linear(0) + 0.7152 * linear(2) + 0.0722 * linear(4);
  return luminance > 0.45 ? DARK_ON_WARM : LIGHT_ON_WARM;
}
