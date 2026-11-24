/**
 * Yalnız yedek: anasayfa canlı `app_categories` tablosunu okuyamazsa
 * (ör. kesinti) kullanılır. Gerçek, güncel 13 ana kategori veritabanında
 * tutulur; bu liste o 13'le aynı tutulmalı ama tek başına kaynak değildir.
 */
export const SECTORS = [
  { slug: "yemek", label: "Yemek" },
  { slug: "kafe", label: "Kafe" },
  { slug: "market", label: "Market" },
  { slug: "giyim", label: "Giyim" },
  { slug: "kisisel-bakim", label: "Kişisel Bakım" },
  { slug: "oto-servisi", label: "Oto Servisi" },
  { slug: "tesisat", label: "Usta ve Tesisat Hizmetleri" },
  { slug: "nakliye", label: "Nakliye" },
  { slug: "taksi", label: "Taksi" },
  { slug: "bilisim-ve-teknoloji", label: "Bilişim ve Teknoloji" },
  { slug: "hayvancilik", label: "Hayvancılık ve Tarım" },
  { slug: "eglence", label: "Eğlence" },
  { slug: "diger", label: "Diğer" },
] as const;

export type SectorSlug = (typeof SECTORS)[number]["slug"];

export const SECTOR_SLUGS = SECTORS.map((s) => s.slug) as readonly SectorSlug[];

export function isSectorSlug(value: unknown): value is SectorSlug {
  return typeof value === "string" && (SECTOR_SLUGS as readonly string[]).includes(value);
}
