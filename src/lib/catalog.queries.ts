import { queryOptions } from "@tanstack/react-query";
import { listRestaurants, listCategories, getRestaurantBySlug } from "@/lib/catalog.functions";

export type HomeSearch = {
  kategori?: string | undefined;
  q?: string | undefined;
  sim?: "reklam" | undefined;
};
export type RestoranSearch = { q?: string | undefined; kategori?: string | undefined };

export function homeQuery(search: HomeSearch) {
  return queryOptions({
    queryKey: ["home-businesses", search.kategori ?? "", search.q ?? ""],
    queryFn: () =>
      listRestaurants({
        data: { sector: search.kategori ?? undefined, search: search.q ?? undefined },
      }),
  });
}

export function restaurantsQuery(search: RestoranSearch) {
  return queryOptions({
    queryKey: ["restaurants", search.q ?? "", search.kategori ?? ""],
    queryFn: () =>
      listRestaurants({
        data: { search: search.q ?? undefined, category: search.kategori ?? undefined },
      }),
  });
}

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: () => listCategories(),
});

export function restaurantDetailQuery(slug: string) {
  return queryOptions({
    queryKey: ["restaurant", slug],
    queryFn: () => getRestaurantBySlug({ data: { slug } }),
  });
}
