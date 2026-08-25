import advertisementsSql from "../../supabase/migrations/20260824160000_advertisements.sql?raw";
import bannersSql from "../../supabase/migrations/20260824223000_banners_storage.sql?raw";

/** SQL uygulandı mı? Sonuç: advertisements satırı + banners kovası. */
export const ADVERTISEMENTS_VERIFY_SQL = `SELECT to_regclass('public.advertisements') AS advertisements_table;
SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'banners';
NOTIFY pgrst, 'reload schema';`;

/** Supabase SQL Editor’a tek parça yapıştırılır: tablo, RPC ve banners kovası. */
export const ADVERTISEMENTS_SETUP_SQL = `-- TAMAMINI çalıştırın. Ekranda görünen ilk satırlar (yalnızca CREATE TYPE) yetmez.
-- Run sonrası Success görünmeli. Sonda NOTIFY pgrst, 'reload schema' vardır.
-- Doğrulama: SELECT to_regclass('public.advertisements');  →  advertisements
--            SELECT id FROM storage.buckets WHERE id = 'banners';  →  banners

${advertisementsSql.trim()}

${bannersSql.trim()}
`;
