import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SiteSettings = {
  id: string;
  brand_name: string;
  primary_color: string;
  accent_color: string;
  secondary_color: string;
  background_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  banner_url: string | null;
  theme_mode: string;
  layout_variant: string;
};

export type HeroContent = {
  hero_badge: string;
  hero_title: string;
  hero_title_accent: string;
  hero_subtitle: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  id: "global",
  brand_name: "SİLVAN CEBİMDE",
  primary_color: "#ff8c42",
  accent_color: "#e63946",
  secondary_color: "#ffe9d6",
  background_color: "#fff8f0",
  logo_url: null,
  favicon_url: null,
  banner_url: null,
  theme_mode: "light",
  layout_variant: "classic",
};

export const DEFAULT_HERO: HeroContent = {
  hero_badge: "işletme, dakikalar içinde kapınızda",
  hero_title: "Mahalleniz hazır,",
  hero_title_accent: "kapınıza geliyor",
  hero_subtitle:
    "Yemek, restoran, kafe, eğlence, market ve giyim: mahallenizdeki tüm işletmeler tek uygulamada.",
};

const SITE_SETTINGS_COLUMNS =
  "id, brand_name, primary_color, accent_color, secondary_color, background_color, logo_url, favicon_url, banner_url, theme_mode, layout_variant, hero_badge, hero_title, hero_title_accent, hero_subtitle";

type SiteSettingsContextValue = {
  settings: SiteSettings;
  hero: HeroContent;
  isFounder: boolean;
  founderExists: boolean;
  refresh: () => void;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  hero: DEFAULT_HERO,
  isFounder: false,
  founderExists: true,
  refresh: () => {},
});

function mergeSettings(row: Record<string, unknown> | null | undefined): SiteSettings & HeroContent {
  return { ...DEFAULT_SETTINGS, ...DEFAULT_HERO, ...(row ?? {}) } as SiteSettings & HeroContent;
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["site-settings"],
    queryFn: async (): Promise<SiteSettings & HeroContent> => {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select(SITE_SETTINGS_COLUMNS)
          .eq("id", "global")
          .maybeSingle();
        if (error) {
          console.error("[site-settings]", error.message);
          return mergeSettings(null);
        }
        return mergeSettings((data ?? {}) as Record<string, unknown>);
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

  const merged = mergeSettings(settingsQuery.data as Record<string, unknown> | null);
  const settings: SiteSettings = merged;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", settings.primary_color);
    root.style.setProperty("--ring", settings.primary_color);
    root.style.setProperty("--accent", settings.accent_color);
    root.style.setProperty("--secondary", settings.secondary_color);
    root.style.setProperty("--background", settings.background_color);
    root.classList.toggle("dark", settings.theme_mode === "dark");
    root.dataset["layout"] = settings.layout_variant;
  }, [
    settings.primary_color,
    settings.accent_color,
    settings.secondary_color,
    settings.background_color,
    settings.theme_mode,
    settings.layout_variant,
  ]);

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
        isFounder: rolesQuery.data?.isFounder ?? false,
        founderExists: rolesQuery.data?.founderExists ?? true,
        refresh: () => {
          void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
          void queryClient.invalidateQueries({ queryKey: ["my-roles"] });
        },
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
