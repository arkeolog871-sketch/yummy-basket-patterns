import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** İşletme kullanıcısının atandığı tek işletmenin kimliğini döner. */
export async function getVendorRestaurantId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("vendor_assignments")
    .select("restaurant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.restaurant_id ?? null;
}

/** Yetki ihlallerinde tek tip hata: panel 403 ekranına düşer. */
export async function assertVendor(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const restaurantId = await getVendorRestaurantId(supabase, userId);
  if (!restaurantId) throw new Error("Forbidden: İşletme yetkisi bulunmuyor");
  return restaurantId;
}
