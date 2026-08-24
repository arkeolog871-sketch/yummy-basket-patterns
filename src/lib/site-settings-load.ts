/** site_settings okuması: harita sütunları canlı şemada henüz yoksa 400 üretmesin. */

export const DEFAULT_SETTINGS = {
  id: "global",
  brand_name: "SİLVAN CEBİMDE",
  primary_color: "#ff8c42",
  accent_color: "#e63946",
  secondary_color: "#ffe9d6",
  background_color: "#fff8f0",
  logo_url: null as string | null,
  favicon_url: null as string | null,
  banner_url: null as string | null,
  theme_mode: "light",
  layout_variant: "classic",
  maps_api_key: null as string | null,
  maps_allowed_referrers: null as string | null,
};

export const DEFAULT_HERO = {
  hero_badge: "işletme, dakikalar içinde kapınızda",
  hero_title: "Mahalleniz hazır,",
  hero_title_accent: "kapınıza geliyor",
  hero_subtitle:
    "Yemek, restoran, kafe, eğlence, market ve giyim: mahallenizdeki tüm işletmeler tek uygulamada.",
};

export const SITE_SETTINGS_CORE_SELECT =
  "id, brand_name, primary_color, accent_color, secondary_color, background_color, logo_url, favicon_url, banner_url, theme_mode, layout_variant, hero_badge, hero_title, hero_title_accent, hero_subtitle";

export const SITE_SETTINGS_MAPS_SELECT = "maps_api_key, maps_allowed_referrers";

function missingMapsColumn(message: string) {
  return /maps_api_key|maps_allowed_referrers/.test(message);
}

export async function loadSiteSettingsRow(client: {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
  };
}) {
  const full = await client
    .from("site_settings")
    .select(`${SITE_SETTINGS_CORE_SELECT}, ${SITE_SETTINGS_MAPS_SELECT}`)
    .eq("id", "global")
    .maybeSingle();

  if (!full.error) return full.data;

  if (!missingMapsColumn(full.error.message)) {
    throw new Error(full.error.message);
  }

  const core = await client
    .from("site_settings")
    .select(SITE_SETTINGS_CORE_SELECT)
    .eq("id", "global")
    .maybeSingle();
  if (core.error) throw new Error(core.error.message);
  return {
    ...(core.data ?? {}),
    maps_api_key: null,
    maps_allowed_referrers: null,
  };
}
