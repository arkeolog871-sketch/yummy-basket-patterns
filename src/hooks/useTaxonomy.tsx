import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SECTORS, CITIES } from "@/lib/sectors";

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

const FALLBACK_AREAS: ServiceArea[] = CITIES.map((entry, index) => {
  const [district, city] = entry.split(", ");
  return {
    id: entry,
    city: city ?? entry,
    district: district ?? entry,
    position: index + 1,
    is_active: true,
  };
});

/** Kurucu panelinden yönetilen dinamik kategoriler (herkese açık okuma). */
export function useAppCategories(options?: { includeHidden?: boolean }) {
  const includeHidden = options?.includeHidden ?? false;
  const query = useQuery({
    queryKey: ["app-categories"],
    queryFn: async (): Promise<AppCategory[]> => {
      const { data, error } = await supabase
        .from("app_categories")
        .select("id, slug, label, icon, position, is_active")
        .order("position");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const rows = query.data && query.data.length > 0 ? query.data : FALLBACK_CATEGORIES;
  return {
    categories: includeHidden ? rows : rows.filter((row) => row.is_active),
    isLoading: query.isLoading,
  };
}

/** Kurucu panelinden yönetilen teslimat bölgeleri. */
export function useServiceAreas(options?: { includeHidden?: boolean }) {
  const includeHidden = options?.includeHidden ?? false;
  const query = useQuery({
    queryKey: ["service-areas"],
    queryFn: async (): Promise<ServiceArea[]> => {
      const { data, error } = await supabase
        .from("service_areas")
        .select("id, city, district, position, is_active")
        .order("position");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const rows = query.data && query.data.length > 0 ? query.data : FALLBACK_AREAS;
  return {
    areas: includeHidden ? rows : rows.filter((row) => row.is_active),
    isLoading: query.isLoading,
  };
}

export function areaLabel(area: ServiceArea) {
  return `${area.district}, ${area.city}`;
}