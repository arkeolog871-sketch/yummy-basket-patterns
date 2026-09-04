import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

const restaurantIdSchema = z.object({ restaurantId: z.string().uuid() });

const reviewSchema = restaurantIdSchema.extend({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(600).optional(),
});

/** Giriş yapmış kullanıcının bu işletmeye zaten bıraktığı yorumu döner (varsa). */
export const getMyReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => restaurantIdSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { data: row, error } = await context.supabase
        .from("reviews")
        .select("id, rating, comment")
        .eq("restaurant_id", data.restaurantId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return row;
    }),
  );

/**
 * Yorum ekler veya (aynı işletmeye zaten yorum bırakılmışsa) günceller.
 * `.from("reviews").upsert(...)` bu tabloda PostgREST üzerinden hep
 * "permission denied for table reviews" ile başarısız oluyordu — yetkiler,
 * RLS ve auth.uid() doğru olsa bile (canlıda doğrulandı). Aynı INSERT ...
 * ON CONFLICT DO UPDATE bir SECURITY INVOKER RPC içinden çağrılınca sorunsuz
 * çalışıyor, bu yüzden yazma burada RPC üzerinden yapılıyor.
 *
 * Yorumcu adı kasıtlı olarak her zaman "Müşteri": profiles.full_name,
 * işletmeci hesaplarında işletme adıyla dolduruluyor (vendor panelinde
 * görünmesi için), bu yüzden yorumlarda gerçek veya işletme adı yerine
 * hiçbir kimlik göstermeyen sabit bir etiket kullanılıyor.
 */
export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { audited } = await import("./audit.server");
      return audited(
        {
          actorId: context.userId,
          action: "review.submit",
          entity: "reviews",
          entityId: data.restaurantId,
        },
        async () => {
          const { error } = await context.supabase.rpc("submit_review", {
            p_restaurant_id: data.restaurantId,
            p_rating: data.rating,
            p_comment: data.comment?.trim() || null,
          });
          if (error) throw new Error(error.message);
          return { ok: true };
        },
      );
    }),
  );

/** Kullanıcının kendi yorumunu siler (bkz. submitReview'daki upsert notu). */
export const deleteMyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => restaurantIdSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { error } = await context.supabase.rpc("delete_my_review", {
        p_restaurant_id: data.restaurantId,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );
