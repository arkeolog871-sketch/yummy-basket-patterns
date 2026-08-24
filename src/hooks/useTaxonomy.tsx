import { useQuery } from "@tanstack/react-query";
import { SECTORS } from "@/lib/sectors";
import { appCategoriesQuery, serviceAreasQuery } from "@/lib/catalog.queries";
import { listAppCategories, listServiceAreas } from "@/lib/taxonomy.functions";

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

/** Kurucu panelinden yönetilen dinamik kategoriler (herkese açık okuma). */
export function useAppCategories(options?: { includeHidden?: boolean }) {
  const includeHidden = options?.includeHidden ?? false;
  const query = useQuery({
    ...appCategoriesQuery,
    queryFn: async (): Promise<AppCategory[]> => {
      try {
        return await listAppCategories();
      } catch {
        return FALLBACK_CATEGORIES;
      }
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
    ...serviceAreasQuery,
    queryFn: async (): Promise<ServiceArea[]> => {
      try {
        return await listServiceAreas();
      } catch {
        return [];
      }
    },
  });

  const rows = query.data ?? [];
  return {
    areas: includeHidden ? rows : rows.filter((row) => row.is_active),
    isLoading: query.isLoading,
  };
}

export function areaLabel(area: ServiceArea) {
  return `${area.district}, ${area.city}`;
}
