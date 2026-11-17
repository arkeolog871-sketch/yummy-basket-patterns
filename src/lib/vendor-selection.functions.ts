import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

/*
 * Bir hesap birden fazla işletmeye bağlı olabilir. Panel işlemleri istemciden
 * gelen işletme kimliğine değil, sunucudaki "seçili işletme" kaydına dayanır;
 * burada yalnız hesaba bağlı bir işletme seçili yapılabilir.
 */

/** Hesaba bağlı tüm işletmeler (panel işletme seçicisi için). */
export const listMyVendorRestaurants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("vendor_assignments")
        .select("restaurant_id, is_selected, created_at, restaurants(name)")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.restaurant_id,
        name: (row.restaurants as { name?: string } | null)?.name ?? "İşletme",
        selected: row.is_selected,
      }));
    }),
  );

/** Paneldeki işletmeyi değiştirir; yalnız hesaba bağlı işletmeler seçilebilir. */
export const selectVendorRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: own, error } = await supabaseAdmin
        .from("vendor_assignments")
        .select("id")
        .eq("user_id", context.userId)
        .eq("restaurant_id", data.restaurantId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!own) throw new Error("Forbidden: Bu işletmeye erişiminiz yok");
      const { error: clearError } = await supabaseAdmin
        .from("vendor_assignments")
        .update({ is_selected: false })
        .eq("user_id", context.userId)
        .eq("is_selected", true);
      if (clearError) throw new Error(clearError.message);
      const { error: setError } = await supabaseAdmin
        .from("vendor_assignments")
        .update({ is_selected: true })
        .eq("id", own.id);
      if (setError) throw new Error(setError.message);
      return { ok: true };
    }),
  );
