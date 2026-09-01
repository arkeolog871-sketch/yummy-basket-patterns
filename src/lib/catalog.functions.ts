import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ilikePattern } from "@/lib/catalog-search";

const listSchema = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.string().trim().max(40).optional(),
  sector: z.string().trim().max(40).optional(),
});

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
      .order("rating", { ascending: false })
      .limit(100);

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

    const detailColumns =
      "id, slug, name, tagline, category, sector, cuisines, rating, review_count, delivery_fee, delivery_minutes, min_order, cover_image_url, is_active, address, district, city, latitude, longitude, maps_url, opens_at, closes_at, is_open_manual, created_at, updated_at";
    const withPhone = `${detailColumns}, contact_phone`;

    let { data: restaurant, error } = await supabase
      .from("restaurants")
      .select(withPhone)
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) {
      const permissionDenied =
        error.code === "42501" ||
        /contact_phone|permission denied|42501/i.test(error.message);
      if (!permissionDenied) throw new Error(error.message);
      const fallback = await supabase
        .from("restaurants")
        .select(detailColumns)
        .eq("slug", data.slug)
        .eq("is_active", true)
        .maybeSingle();
      if (fallback.error) throw new Error(fallback.error.message);
      restaurant = fallback.data
        ? { ...fallback.data, contact_phone: null as string | null }
        : null;
      if (restaurant) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: phoneRow } = await supabaseAdmin
            .from("restaurants")
            .select("contact_phone")
            .eq("id", restaurant.id)
            .maybeSingle();
          restaurant = {
            ...restaurant,
            contact_phone: phoneRow?.contact_phone ?? null,
          };
        } catch {
          // Servis anahtarı yoksa kart gizlenir; sabit numara yazılmaz.
        }
      }
    }
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