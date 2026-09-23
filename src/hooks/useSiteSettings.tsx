import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SplashScreen } from "@/components/system/SplashScreen";
import {
  seedFromHex,
  themeBackgroundHex,
  themeCssVariables,
  themeTextSurfaces,
} from "@/lib/theme-palette";
import {
  applyTypographyCss,
  DEFAULT_TYPOGRAPHY,
  isMissingColumnError,
  isTypographyConfigured,
  parseTypography,
  SITE_SETTINGS_BASE_COLUMNS,
  SITE_SETTINGS_COLUMNS_WITH_TYPOGRAPHY,
  type TypographySettings,
} from "@/lib/typography";

export type SiteSettings = {
  id: string;
  brand_name: string;
  primary_color: string;
  accent_color: string;
  secondary_color: string;
  background_color: string;
  warm_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  banner_url: string | null;
  theme_mode: string;
  layout_variant: string;
  typography: TypographySettings;
  typographyConfigured: boolean;
};

export type HeroContent = {
  hero_badge: string;
  hero_title: string;
  hero_title_accent: string;
  hero_subtitle: string;
};

export type FounderContactInfo = {
  founder_contact_phone: string;
  founder_contact_email: string;
};

export type FooterContent = {
  footer_tagline: string;
  footer_delivery_hours: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  id: "global",
  brand_name: "SİLVAN CEBİMDE",
  primary_color: "#932030",
  accent_color: "#f0ba66",
  secondary_color: "#edddc6",
  background_color: "#f4edda",
  warm_color: "#f0ba66",
  logo_url: null,
  favicon_url: null,
  banner_url: null,
  theme_mode: "light",
  layout_variant: "classic",
  typography: DEFAULT_TYPOGRAPHY,
  typographyConfigured: false,
};

export const DEFAULT_HERO: HeroContent = {
  hero_badge: "işletme, dakikalar içinde kapınızda",
  hero_title: "Mahalleniz hazır,",
  hero_title_accent: "kapınıza geliyor",
  hero_subtitle:
    "Yemek, restoran, kafe, eğlence, market ve giyim: mahallenizdeki tüm işletmeler tek uygulamada.",
};

export const DEFAULT_FOUNDER_CONTACT: FounderContactInfo = {
  founder_contact_phone: "0546 696 31 33",
  founder_contact_email: "arkeolog871@gmail.com",
};

export const DEFAULT_FOOTER: FooterContent = {
  footer_tagline: "Mahallenin en iyi ustalarından sıcak yemekler, kapınıza kadar.",
  footer_delivery_hours: "Her gün 10:00 – 23:30",
};

type SiteSettingsContextValue = {
  settings: SiteSettings;
  hero: HeroContent;
  founderContact: FounderContactInfo;
  footer: FooterContent;
  isFounder: boolean;
  founderExists: boolean;
  /** Şu an koyu tema mı (kurucu "Koyu" seçtiyse ya da "Otomatik" + cihaz koyu). */
  isDark: boolean;
  refresh: () => void;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  hero: DEFAULT_HERO,
  founderContact: DEFAULT_FOUNDER_CONTACT,
  footer: DEFAULT_FOOTER,
  isFounder: false,
  founderExists: true,
  isDark: false,
  refresh: () => {},
});

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToColorScheme(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Cihaz koyu modda mı. Sunucuda ve eski tarayıcıda açık varsayılır.
 *
 * ÖLÇÜLDÜ (kaynak kod): uygulama kabukları cihazdan bağımsız hep AÇIK
 * bildiriyor: iOS Info.plist'te UIUserInterfaceStyle = Light, Android
 * teması Theme.Material.Light. Yani "Otomatik" yalnızca tarayıcıda ve
 * ana ekrana eklenen sürümde koyuya geçer; uygulamalar açık kalır ve
 * durum çubuklarıyla uyumsuzluk oluşmaz.
 */
function usePrefersDark(): boolean {
  return useSyncExternalStore(
    subscribeToColorScheme,
    () => typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
}

function mergeSettings(
  row: Record<string, unknown> | null | undefined,
): SiteSettings & HeroContent & FounderContactInfo & FooterContent {
  const raw = row ?? {};
  const rest = { ...raw };
  delete rest["typography"];
  return {
    ...DEFAULT_SETTINGS,
    ...DEFAULT_HERO,
    ...DEFAULT_FOUNDER_CONTACT,
    ...DEFAULT_FOOTER,
    ...rest,
    typography: parseTypography(raw["typography"]),
    typographyConfigured: isTypographyConfigured(raw["typography"]),
  } as SiteSettings & HeroContent & FounderContactInfo & FooterContent;
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["site-settings"],
    queryFn: async (): Promise<SiteSettings & HeroContent & FounderContactInfo & FooterContent> => {
      try {
        const withTypography = await supabase
          .from("site_settings")
          .select(SITE_SETTINGS_COLUMNS_WITH_TYPOGRAPHY)
          .eq("id", "global")
          .maybeSingle();
        if (withTypography.error && isMissingColumnError(withTypography.error, "typography")) {
          const fallback = await supabase
            .from("site_settings")
            .select(SITE_SETTINGS_BASE_COLUMNS)
            .eq("id", "global")
            .maybeSingle();
          if (fallback.error) {
            console.error("[site-settings]", fallback.error.message);
            return mergeSettings(null);
          }
          return mergeSettings((fallback.data ?? {}) as Record<string, unknown>);
        }
        if (withTypography.error) {
          console.error("[site-settings]", withTypography.error.message);
          return mergeSettings(null);
        }
        return mergeSettings((withTypography.data ?? {}) as Record<string, unknown>);
      } catch (error) {
        console.error("[site-settings]", error);
        return mergeSettings(null);
      }
    },
    retry: false,
  });

  const rolesQuery = useQuery({
    queryKey: ["my-roles", user?.id ?? "anon"],
    enabled: Boolean(user),
    queryFn: async () => {
      try {
        const [own, founders] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", user!.id),
          supabase
            .from("user_roles")
            .select("id", { count: "exact", head: true })
            .eq("role", "founder"),
        ]);
        if (own.error) {
          console.error("[my-roles]", own.error.message);
          return { isFounder: false, founderExists: true };
        }
        return {
          isFounder: (own.data ?? []).some((row) => row.role === "founder"),
          founderExists: (founders.count ?? 0) > 0,
        };
      } catch (error) {
        console.error("[my-roles]", error);
        return { isFounder: false, founderExists: true };
      }
    },
    retry: false,
  });

  const merged = settingsQuery.data ?? mergeSettings(null);
  const settings: SiteSettings = merged;
  const prefersDark = usePrefersDark();
  const isDark =
    settings.theme_mode === "dark" || (settings.theme_mode === "system" && prefersDark);

  useEffect(() => {
    // Ayarlar henüz gelmeden DEFAULT_SETTINGS'i (eski/varsayılan renk şeması)
    // uygulamak açılışta kısa bir yanlış renk yanıp sönmesine yol açıyordu;
    // gerçek ayarlar (veya kesin bir hata) gelene kadar bekle — bu sırada
    // sayfa styles.css'teki derlenmiş varsayılanları kullanır ve zaten tam
    // ekran splash tarafından örtülür (bkz. SplashScreen).
    if (settingsQuery.isLoading) return;
    const root = document.documentElement;
    // Renkler TEK TOHUMDAN türetilir (theme-palette.ts): tohum primary_color'da
    // saklanır; diğer sütunlar yok sayılır. Eskiden 5 serbest renk doğrudan
    // yazılıyordu ve canlıda vurgu/ikincil/zemin aynı krem seçildiği için
    // tuşlar ve simgeler görünmez olmuştu. Üretici her yazı/zemin çiftini
    // en az 4.5:1'e zorlar. Koyu tema ("Gece Çarşısı") aynı tohumdan.
    const gamut =
      typeof window.matchMedia === "function" && window.matchMedia("(color-gamut: p3)").matches
        ? "p3"
        : "srgb";
    const seed = seedFromHex(settings.primary_color);
    const scheme = isDark ? "dark" : "light";
    const variables = themeCssVariables(seed, gamut, scheme);
    for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
    root.classList.toggle("dark", isDark);
    // Kaydırma çubuğu, form denetimleri gibi tarayıcı parçaları da temaya uysun.
    root.style.colorScheme = scheme;
    // Tarayıcı çubuğu (Android Chrome, Safari sekme çubuğu) sayfa zeminiyle aynı.
    const background = themeBackgroundHex(seed, scheme);
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = background;
    }
    root.dataset["layout"] = settings.layout_variant;
  }, [settingsQuery.isLoading, settings.primary_color, isDark, settings.layout_variant]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!settings.typographyConfigured) return;
    // Açık temada yazı renkleri temanın zeminlerinde ≥ 4.5:1'e zorlanır;
    // koyu temada renkler temadan gelir (kurucunun renkleri açık zemin için).
    const readability = isDark ? "dark" : themeTextSurfaces(seedFromHex(settings.primary_color));
    applyTypographyCss(settings.typography, document.documentElement, readability);
  }, [settings.typography, settings.typographyConfigured, isDark, settings.primary_color]);

  useEffect(() => {
    if (!settings.favicon_url) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = settings.favicon_url;
  }, [settings.favicon_url]);

  return (
    <SiteSettingsContext.Provider
      value={{
        settings,
        hero: {
          hero_badge: merged.hero_badge ?? DEFAULT_HERO.hero_badge,
          hero_title: merged.hero_title ?? DEFAULT_HERO.hero_title,
          hero_title_accent: merged.hero_title_accent ?? DEFAULT_HERO.hero_title_accent,
          hero_subtitle: merged.hero_subtitle ?? DEFAULT_HERO.hero_subtitle,
        },
        founderContact: {
          founder_contact_phone:
            merged.founder_contact_phone ?? DEFAULT_FOUNDER_CONTACT.founder_contact_phone,
          founder_contact_email:
            merged.founder_contact_email ?? DEFAULT_FOUNDER_CONTACT.founder_contact_email,
        },
        footer: {
          footer_tagline: merged.footer_tagline ?? DEFAULT_FOOTER.footer_tagline,
          footer_delivery_hours:
            merged.footer_delivery_hours ?? DEFAULT_FOOTER.footer_delivery_hours,
        },
        isFounder: rolesQuery.data?.isFounder ?? false,
        founderExists: rolesQuery.data?.founderExists ?? true,
        isDark,
        refresh: () => {
          void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
          void queryClient.invalidateQueries({ queryKey: ["my-roles"] });
        },
      }}
    >
      <SplashScreen ready={!settingsQuery.isLoading} />
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
