import oneshotSql from "../../supabase/sql/advertisements_oneshot.sql?raw";

/** SQL uygulandı mı? Sonuç satırı: advertisements / true. */
export const ADVERTISEMENTS_VERIFY_SQL = `SELECT
  to_regclass('public.advertisements')::text AS advertisements_table,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_active_banners'
  ) AS get_active_banners;
NOTIFY pgrst, 'reload schema';`;

/** SQL Editor’a tek parça: tablo, RPC, görünüm, banners kovası. Sonda sonuç satırı gelir. */
export const ADVERTISEMENTS_SETUP_SQL = oneshotSql.trim();
