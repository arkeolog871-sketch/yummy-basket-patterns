/**
 * İşletme kategori kataloğunun göç dosyasını üretir (src/lib/business-category-catalog.ts
 * → supabase/migrations/20260924150000_business_category_catalog.sql).
 *
 * Katalog değişince YENİ bir göç dosyası üretin; uygulanmış göçü değiştirmeyin.
 * Kullanım: bunx tsx scripts/gen-business-category-seed.ts [çıktı-yolu]
 */
import { writeFileSync } from "node:fs";
import { BUSINESS_CATEGORY_CATALOG } from "../src/lib/business-category-catalog";
import { businessCategorySeedSql } from "../src/lib/business-category-seed";

const out = process.argv[2] ?? "supabase/migrations/20260924150000_business_category_catalog.sql";

const header = `-- İşletme kategori kataloğu: işletme başvurusu ve Sayfa Yöneticisi Paneli'ndeki
-- "Alt tür" arama motorunun ortak kaynağı. Mevcut 14 ana kategoriye
-- (app_categories) DOKUNMAZ; her satır isteğe bağlı olarak birine bağlanır
-- (sector_slug). Seçilen ad restaurants.category'ye yazılır; oradaki eski
-- serbest metinler geçerli kalır.
--
-- Bu dosya scripts/gen-business-category-seed.ts ile üretildi.

CREATE TABLE IF NOT EXISTS public.business_category_catalog (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) <= 60),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 40),
  group_name text NOT NULL CHECK (length(group_name) BETWEEN 2 AND 60),
  sector_slug text CHECK (sector_slug IS NULL OR sector_slug ~ '^[a-z0-9-]+$'),
  synonyms text[] NOT NULL DEFAULT '{}'::text[],
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_category_catalog ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (başvuru formu giriş yapmadan da açılabiliyor); yazma
-- yalnız servis rolüyle (göç / sunucu). Tarayıcıdan ekleme-silme yok.
DROP POLICY IF EXISTS business_category_catalog_public_read ON public.business_category_catalog;
CREATE POLICY business_category_catalog_public_read
  ON public.business_category_catalog
  FOR SELECT
  TO anon, authenticated
  USING (is_active);

REVOKE ALL ON public.business_category_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_category_catalog TO anon, authenticated;
GRANT ALL ON public.business_category_catalog TO service_role;

`;

writeFileSync(out, `${header}${businessCategorySeedSql(BUSINESS_CATEGORY_CATALOG)}\n`);
console.log(`${BUSINESS_CATEGORY_CATALOG.length} kategori → ${out}`);
