import advertisementsSql from "../../supabase/migrations/20260824160000_advertisements.sql?raw";
import bannersSql from "../../supabase/migrations/20260824223000_banners_storage.sql?raw";

/** Supabase SQL Editor’a tek parça yapıştırılır: tablo, RPC ve banners kovası. */
export const ADVERTISEMENTS_SETUP_SQL = `${advertisementsSql.trim()}

${bannersSql.trim()}
`;
