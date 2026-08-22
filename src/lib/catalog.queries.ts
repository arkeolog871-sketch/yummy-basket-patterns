import { queryOptions } from "@tanstack/react-query";
import { listRestaurants, listCategories, getRestaurantBySlug } from "@/lib/catalog.functions";

export type HomeSearch = { kategori?: string | undefined; q?: string | undefined };
export type RestoranSearch = { q?: string | undefined; kategori?: string | undefined };

const liveQuery = {
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchInterval: 12_000,
} as const;

export function homeQuery(search: HomeSearch) {
  return queryOptions({
    queryKey: ["home-businesses", search.kategori ?? "", search.q ?? ""],
    queryFn: () =>
      listRestaurants({
        data: { sector: search.kategori ?? undefined, search: search.q ?? undefined },
      }),
    ...liveQuery,
  });
}

export function restaurantsQuery(search: RestoranSearch) {
  return queryOptions({
    queryKey: ["restaurants", search.q ?? "", search.kategori ?? ""],
    queryFn: () =>
      listRestaurants({
        data: { search: search.q ?? undefined, category: search.kategori ?? undefined },
      }),
    ...liveQuery,
  });
}

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: () => listCategories(),
  ...liveQuery,
});

export function restaurantDetailQuery(slug: string) {
  return queryOptions({
    queryKey: ["restaurant", slug],
    queryFn: () => getRestaurantBySlug({ data: { slug } }),
    ...liveQuery,
  });
}
