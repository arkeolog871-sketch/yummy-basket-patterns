import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const listSchema = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.string().trim().max(40).optional(),
  sector: z.string().trim().max(40).optional(),
});

/** PostgREST `or`/`ilike` için güvenli desen — virgül veya joker karakter aramayı bozmasın. */
function ilikePattern(raw: string): string | null {
  const escaped = raw
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[%_]/g, "")
    .replace(/[,()]/g, " ")
    .trim();
  if (!escaped) return null;
  return `"%${escaped}%"`;
}

export const listRestaurants = createServerFn({ method: "GET" })
  .validator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { createPublicClient } = await import("./catalog.server");
    const supabase = createPublicClient();

    let query = supabase
      .from("restaurants")
      .select(
        "id, slug, name, tagline, category, sector, cuisines, rating, review_count, delivery_fee, delivery_minutes, min_order, cover_image_url, address, district, city, latitude, longitude, maps_url, opens_at, closes_at, is_open_manual",
      )
      .eq("is_active", true)
      .order("rating", { ascending: false });

    if (data.category) query = query.eq("category", data.category);
    if (data.sector) query = query.eq("sector", data.sector);
    if (data.search) {
      const pattern = ilikePattern(data.search);
      if (pattern) {
        query = query.or(`name.ilike.${pattern},tagline.ilike.${pattern},category.ilike.${pattern}`);
      }
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicClient } = await import("./catalog.server");
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("restaurants")
    .select("category")
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"));
});

export const getRestaurantBySlug = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { createPublicClient } = await import("./catalog.server");
    const supabase = createPublicClient();

    const { data: restaurant, error } = await supabase
      .from("restaurants")
      .select(
        "id, slug, name, tagline, category, sector, cuisines, rating, review_count, delivery_fee, delivery_minutes, min_order, cover_image_url, is_active, address, district, city, latitude, longitude, maps_url, opens_at, closes_at, is_open_manual, created_at, updated_at",
      )
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!restaurant) return null;

    const [{ data: categories }, { data: items }] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("id, name, position")
        .eq("restaurant_id", restaurant.id)
        .order("position"),
      supabase
        .from("menu_items")
        .select("id, name, description, price, image_url, is_popular, category_id")
        .eq("restaurant_id", restaurant.id)
        .eq("is_available", true)
        .order("name"),
    ]);

    return {
      restaurant,
      categories: categories ?? [],
      items: items ?? [],
    };
  });