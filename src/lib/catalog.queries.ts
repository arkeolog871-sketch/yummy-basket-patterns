import { queryOptions } from "@tanstack/react-query";
import { listRestaurants, listCategories, getRestaurantBySlug } from "@/lib/catalog.functions";
import { getSiteSettings } from "@/lib/founder.functions";
import { listAppCategories, listServiceAreas } from "@/lib/taxonomy.functions";

export type HomeSearch = { kategori?: string | undefined; q?: string | undefined };
export type RestoranSearch = { q?: string | undefined; kategori?: string | undefined };

const PUBLIC_STALE_MS = 15_000;

export function homeQuery(search: HomeSearch) {
  return queryOptions({
    queryKey: ["home-businesses", search.kategori ?? "", search.q ?? ""],
    staleTime: PUBLIC_STALE_MS,
    queryFn: () =>
      listRestaurants({
        data: { sector: search.kategori ?? undefined, search: search.q ?? undefined },
      }),
  });
}

export function restaurantsQuery(search: RestoranSearch) {
  return queryOptions({
    queryKey: ["restaurants", search.q ?? "", search.kategori ?? ""],
    staleTime: PUBLIC_STALE_MS,
    queryFn: () =>
      listRestaurants({
        data: { search: search.q ?? undefined, category: search.kategori ?? undefined },
      }),
  });
}

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  staleTime: PUBLIC_STALE_MS,
  queryFn: () => listCategories(),
});

export function restaurantDetailQuery(slug: string) {
  return queryOptions({
    queryKey: ["restaurant", slug],
    staleTime: PUBLIC_STALE_MS,
    queryFn: () => getRestaurantBySlug({ data: { slug } }),
  });
}

export const siteSettingsQuery = queryOptions({
  queryKey: ["site-settings"],
  staleTime: PUBLIC_STALE_MS,
  queryFn: () => getSiteSettings(),
});

export const appCategoriesQuery = queryOptions({
  queryKey: ["app-categories"],
  staleTime: PUBLIC_STALE_MS,
  queryFn: () => listAppCategories(),
});

export const serviceAreasQuery = queryOptions({
  queryKey: ["service-areas"],
  staleTime: PUBLIC_STALE_MS,
  queryFn: () => listServiceAreas(),
});
