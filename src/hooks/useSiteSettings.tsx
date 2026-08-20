import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SiteSettings = {
  id: string;
  brand_name: string;
  primary_color: string;
  accent_color: string;
  theme_mode: string;
  layout_variant: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  id: "global",
  brand_name: "SofraKapımda",
  primary_color: "#ff8c42",
  accent_color: "#e63946",
  theme_mode: "light",
  layout_variant: "classic",
};

type SiteSettingsContextValue = {
  settings: SiteSettings;
  isFounder: boolean;
  founderExists: boolean;
  refresh: () => void;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  isFounder: false,
  founderExists: true,
  refresh: () => {},
});

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const settingsQuery = useQuery({
    queryKey: ["site-settings"],
    enabled: hydrated,
    queryFn: async (): Promise<SiteSettings> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("id, brand_name, primary_color, accent_color, theme_mode, layout_variant")
        .eq("id", "global")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? DEFAULT_SETTINGS;
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["my-roles", user?.id ?? "anon"],
    enabled: hydrated && Boolean(user),
    queryFn: async () => {
      const [own, founders] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "founder"),
      ]);
      if (own.error) throw new Error(own.error.message);
      return {
        isFounder: (own.data ?? []).some((row) => row.role === "founder"),
        founderExists: (founders.count ?? 0) > 0,
      };
    },
  });

  const settings = settingsQuery.data ?? DEFAULT_SETTINGS;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", settings.primary_color);
    root.style.setProperty("--ring", settings.primary_color);
    root.style.setProperty("--accent", settings.accent_color);
    root.classList.toggle("dark", settings.theme_mode === "dark");
    root.dataset["layout"] = settings.layout_variant;
  }, [settings.primary_color, settings.accent_color, settings.theme_mode, settings.layout_variant]);

  return (
    <SiteSettingsContext.Provider
      value={{
        settings,
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