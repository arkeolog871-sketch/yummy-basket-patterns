import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { siteSettingsQuery } from "@/lib/catalog.queries";
import { getSiteSettings } from "@/lib/founder.functions";
import { DEFAULT_HERO, DEFAULT_SETTINGS } from "@/lib/site-settings-load";

export type SiteSettings = typeof DEFAULT_SETTINGS;
export type HeroContent = typeof DEFAULT_HERO;
export { DEFAULT_SETTINGS, DEFAULT_HERO };

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
    ...siteSettingsQuery,
    queryFn: async () => {
      try {
        return await getSiteSettings();
      } catch {
        return mergeSettings(null);
      }
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["my-roles", user?.id ?? "anon"],
    enabled: Boolean(user),
    queryFn: async () => {
      const [own, founders] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role", "founder"),
      ]);
      if (own.error) throw new Error(own.error.message);
      return {
        isFounder: (own.data ?? []).some((row) => row.role === "founder"),
        founderExists: (founders.count ?? 0) > 0,
      };
    },
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
