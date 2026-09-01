export const SECTORS = [
  { slug: "yemek", label: "Yemek" },
  { slug: "restoran", label: "Restoran" },
  { slug: "kafe", label: "Kafe" },
  { slug: "eglence", label: "Eğlence" },
  { slug: "market", label: "Market" },
  { slug: "giyim", label: "Giyim" },
] as const;

export type SectorSlug = (typeof SECTORS)[number]["slug"];

export const SECTOR_SLUGS = SECTORS.map((s) => s.slug) as readonly SectorSlug[];

export function isSectorSlug(value: unknown): value is SectorSlug {
  return typeof value === "string" && (SECTOR_SLUGS as readonly string[]).includes(value);
}
