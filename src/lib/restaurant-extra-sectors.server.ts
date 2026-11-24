import { findExactCategory } from "./category-search";
import { BUSINESS_CATEGORY_CATALOG, resolveExtraCatalogSectors } from "./business-category-catalog";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kullanıcı isteği: bir işletme (ör. dönerci) aynı anda birden fazla ana
 * kategoride görünsün. `restaurants.sector` tek değer (birincil) kalır;
 * bu tablo yalnızca ana sayfa filtresinin EK eşleştirdiği sektörleri tutar.
 * İşletme kaydedildiğinde (yeni/düzenleme/başvuru onayı) buradan çağrılıp
 * o işletmenin ek sektör satırları baştan yazılır.
 */
export async function syncRestaurantExtraSectors(
  supabaseAdmin: SupabaseClient,
  params: { restaurantId: string; category: string },
): Promise<void> {
  const entry = findExactCategory(BUSINESS_CATEGORY_CATALOG, params.category);
  const { data: categories, error: categoriesError } = await supabaseAdmin
    .from("app_categories")
    .select("slug");
  if (categoriesError) {
    console.error("[restaurant-extra-sectors] ana kategoriler okunamadı", categoriesError.message);
    return;
  }
  const availableSlugs = (categories ?? []).map((row) => row.slug as string);
  const extraSectors = entry ? resolveExtraCatalogSectors(entry, availableSlugs) : [];

  const { error: deleteError } = await supabaseAdmin
    .from("restaurant_extra_sectors")
    .delete()
    .eq("restaurant_id", params.restaurantId);
  if (deleteError) {
    console.error("[restaurant-extra-sectors] eski kayıtlar silinemedi", deleteError.message);
    return;
  }
  if (extraSectors.length === 0) return;

  const { error: insertError } = await supabaseAdmin.from("restaurant_extra_sectors").insert(
    extraSectors.map((sectorSlug) => ({
      restaurant_id: params.restaurantId,
      sector_slug: sectorSlug,
    })),
  );
  if (insertError) {
    console.error("[restaurant-extra-sectors] yeni kayıtlar yazılamadı", insertError.message);
  }
}
