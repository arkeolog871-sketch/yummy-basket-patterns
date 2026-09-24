import type { BusinessCategoryEntry } from "./business-category-catalog";

/**
 * `business_category_catalog` tablosunun tohum SQL'i. Göç dosyası bununla
 * üretildi; test, göçün kataloğun bugünkü hâliyle aynı olduğunu denetler.
 * Yeniden üretmek için: `bunx tsx scripts/gen-business-category-seed.ts`.
 */

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function arrayLiteral(values: readonly string[]): string {
  if (values.length === 0) return "'{}'::text[]";
  return `ARRAY[${values.map(literal).join(", ")}]::text[]`;
}

export function businessCategorySeedSql(catalog: readonly BusinessCategoryEntry[]): string {
  const rows = catalog.map(
    (entry) =>
      `  (${literal(entry.slug)}, ${literal(entry.name)}, ${literal(entry.group_name)}, ${
        entry.sector_slug ? literal(entry.sector_slug) : "NULL"
      }, ${arrayLiteral(entry.synonyms)}, ${entry.position})`,
  );
  return [
    "INSERT INTO public.business_category_catalog (slug, name, group_name, sector_slug, synonyms, position)",
    "VALUES",
    rows.join(",\n"),
    "ON CONFLICT (slug) DO UPDATE SET",
    "  name = EXCLUDED.name,",
    "  group_name = EXCLUDED.group_name,",
    "  sector_slug = EXCLUDED.sector_slug,",
    "  synonyms = EXCLUDED.synonyms,",
    "  position = EXCLUDED.position,",
    "  is_active = true,",
    "  updated_at = now();",
  ].join("\n");
}
