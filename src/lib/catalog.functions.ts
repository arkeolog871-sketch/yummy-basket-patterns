import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  matchesSearchTerms,
  productIlikePattern,
  rankSearchMatch,
  searchTokens,
} from "@/lib/catalog-search";

const LIST_COLUMNS =
  "id, slug, name, tagline, category, sector, cuisines, rating, review_count, delivery_fee, delivery_type, delivery_minutes, min_order, cover_image_url, logo_url, address, district, city, latitude, longitude, maps_url, mobile_service, opens_at, closes_at, is_open_manual";

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
      .select(LIST_COLUMNS)
      .eq("is_active", true)
      // Elle sıralanan işletmeler önce (NULL en sona), sonra puana göre.
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("rating", { ascending: false })
      .limit(100);

    if (data.category) query = query.eq("category", data.category);
    if (data.sector) query = query.eq("sector", data.sector);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const all: Array<NonNullable<typeof rows>[number] & { matched_products?: string[] }> =
      rows ?? [];
    if (!data.search) return all;

    // Arama bellekte yapılır: `ilike` aksana duyarlı ("kuafor" "Kuaför"ü
    // bulamıyordu) ve cümle aramasında kelimeler ayrı ayrı aranmalı.
    const tokens = searchTokens(data.search);
    if (tokens.length === 0) {
      return all.filter((row) =>
        matchesSearchTerms(
          [row.name, row.tagline, row.category, row.sector, row.district, row.city],
          data.search as string,
        ),
      );
    }

    // Ürün adları da aranır (kutu "İşletme, mutfak veya ürün ara" diyor;
    // canlıda "keratin" hiçbir işletme döndürmüyordu). Veritabanı jokerli
    // desenle daraltır, kesin eşleşme `rankSearchMatch`'te.
    const productsByRestaurant = new Map<string, string[]>();
    if (all.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from("menu_items")
        .select("restaurant_id, name")
        .eq("is_available", true)
        .in(
          "restaurant_id",
          all.map((row) => row.id),
        )
        .or(tokens.map((token) => `name.ilike.${productIlikePattern(token)}`).join(","))
        .limit(500);
      if (itemsError) {
        // Ürün araması düşerse işletme araması yine çalışsın.
        console.error("[catalog] ürün araması:", itemsError.message);
      }
      for (const item of items ?? []) {
        const list = productsByRestaurant.get(item.restaurant_id) ?? [];
        list.push(item.name);
        productsByRestaurant.set(item.restaurant_id, list);
      }
    }

    return all
      .map((row, order) => ({
        row,
        order,
        match: rankSearchMatch(
          tokens,
          [
            { text: row.name, weight: 4 },
            { text: row.category, weight: 3 },
            { text: row.sector, weight: 3 },
            { text: (row.cuisines ?? []).join(" "), weight: 3 },
            { text: row.tagline, weight: 2 },
            { text: row.district, weight: 1 },
            { text: row.city, weight: 1 },
          ],
          productsByRestaurant.get(row.id) ?? [],
        ),
      }))
      .filter(({ match }) => match.matched > 0)
      .sort(
        (a, b) =>
          b.match.matched - a.match.matched || b.match.score - a.match.score || a.order - b.order,
      )
      .map(({ row, match }) =>
        match.products.length > 0 ? { ...row, matched_products: match.products.slice(0, 3) } : row,
      );
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
      "id, slug, name, tagline, category, sector, cuisines, rating, review_count, delivery_fee, delivery_type, delivery_minutes, min_order, cover_image_url, logo_url, is_active, address, district, city, latitude, longitude, maps_url, mobile_service, opens_at, closes_at, is_open_manual, created_at, updated_at";
    const withPhone = `${detailColumns}, contact_phone`;

    const primary = await supabase
      .from("restaurants")
      .select(withPhone)
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    let restaurant = primary.data;
    const error = primary.error;
    if (error) {
      const permissionDenied =
        error.code === "42501" || /contact_phone|permission denied|42501/i.test(error.message);
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

    // Stok bilgisi ürün listesini beklemeden aynı anda çekilir (eskiden
    // ürünler geldikten sonra ayrı bir tur daha bekleniyordu).
    const [
      { data: categories },
      { data: items },
      { data: gallery },
      { data: reviews },
      stockFlags,
    ] = await Promise.all([
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
      supabase
        .from("business_media")
        .select("id, url")
        .eq("restaurant_id", restaurant.id)
        .eq("kind", "gallery")
        .order("position"),
      supabase
        .from("reviews")
        .select(
          "id, rating, comment, author_name, created_at, verified_order_id, seller_reply, seller_reply_at",
        )
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(50),
      readStockFlags(restaurant.id),
    ]);

    const menuItems = items ?? [];

    return {
      restaurant,
      categories: categories ?? [],
      items: menuItems.map((item) => ({
        ...item,
        in_stock: stockFlags.get(item.id) ?? true,
      })),
      gallery: gallery ?? [],
      reviews: reviews ?? [],
    };
  });

/**
 * `stock_quantity` vitrine kapalıdır (20260904140000_security_audit_grants.sql):
 * rakip işletme stok seviyesini görmemeli. Ama stoğu biten ürün sipariş
 * RPC'sinde reddediliyor ve müşteri bunu ancak "Siparişi onayla" adımında
 * öğreniyordu. Sayı sunucuda okunup boole'ye indirgeniyor; tarayıcıya yalnızca
 * "satılabilir mi" bilgisi gidiyor.
 *
 * Servis anahtarı yoksa harita boş döner ve çağıran taraf ürünü satılabilir
 * sayar: stok bilgisi eksikken vitrini kapatmak, mevcut davranışı bozar.
 */
async function readStockFlags(restaurantId: string): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Vitrindeki ürünlerle aynı küme (işletme + satışta), kimlik listesi
    // beklemeden. Eskiden `.in("id", ids)` binlerce kimlikle adres sınırını da
    // aşabiliyordu; o durumda bilgi boş dönüp ürünler satılabilir sayılıyordu.
    const { data, error } = await supabaseAdmin
      .from("menu_items")
      .select("id, stock_quantity")
      .eq("restaurant_id", restaurantId)
      .eq("is_available", true);
    if (error || !data) return flags;
    const { isSellableStock } = await import("./orders-stock");
    for (const row of data) flags.set(row.id, isSellableStock(row.stock_quantity));
  } catch {
    // Servis anahtarı yok; stok bilgisi olmadan ürün gizlenmez.
  }
  return flags;
}
