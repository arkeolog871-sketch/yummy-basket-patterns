import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SECTORS } from "@/lib/sectors";

export type AppCategory = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  position: number;
  is_active: boolean;
};

export type ServiceArea = {
  id: string;
  city: string;
  district: string;
  position: number;
  is_active: boolean;
};

const FALLBACK_CATEGORIES: AppCategory[] = SECTORS.map((sector, index) => ({
  id: sector.slug,
  slug: sector.slug,
  label: sector.label,
  icon: "UtensilsCrossed",
  position: index + 1,
  is_active: true,
}));

/** SSR ve istemci ilk boyası aynı metni görsün; veri gelince yerini alır. */
const FALLBACK_AREAS: ServiceArea[] = [
  {
    id: "silvan",
    city: "DİYARBAKIR",
    district: "SİLVAN",
    position: 1,
    is_active: true,
  },
];

/** Kurucu panelinden yönetilen dinamik kategoriler (herkese açık okuma). */
export function useAppCategories(options?: { includeHidden?: boolean }) {
  const includeHidden = options?.includeHidden ?? false;
  const query = useQuery({
    queryKey: ["app-categories"],
    queryFn: async (): Promise<AppCategory[]> => {
      try {
        const { data, error } = await supabase
          .from("app_categories")
          .select("id, slug, label, icon, position, is_active")
          .order("position");
        if (error) {
          console.error("[app-categories]", error.message);
          return [];
        }
        return data ?? [];
      } catch (error) {
        console.error("[app-categories]", error);
        return [];
      }
    },
    retry: false,
  });

  const loaded = query.data ?? [];
  const rows = includeHidden
    ? loaded
    : (loaded.length > 0 ? loaded : FALLBACK_CATEGORIES).filter((row) => row.is_active);
  return {
    categories: rows,
    isLoading: query.isLoading,
  };
}

/** Kurucu panelinden yönetilen teslimat bölgeleri. */
export function useServiceAreas(options?: { includeHidden?: boolean }) {
  const includeHidden = options?.includeHidden ?? false;
  const query = useQuery({
    queryKey: ["service-areas"],
    queryFn: async (): Promise<ServiceArea[]> => {
      try {
        const { data, error } = await supabase
          .from("service_areas")
          .select("id, city, district, position, is_active")
          .order("position");
        if (error) {
          console.error("[service-areas]", error.message);
          return [];
        }
        return data ?? [];
      } catch (error) {
        console.error("[service-areas]", error);
        return [];
      }
    },
    retry: false,
  });

  const loaded = query.data ?? [];
  const rows = includeHidden
    ? loaded
    : (loaded.length > 0 ? loaded : FALLBACK_AREAS).filter((row) => row.is_active);
  return {
    areas: rows,
    isLoading: query.isLoading,
  };
}

export function areaLabel(area: ServiceArea) {
  return `${area.district}, ${area.city}`;
}
