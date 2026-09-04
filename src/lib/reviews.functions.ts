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

/** Yorum ekler veya (aynı işletmeye zaten yorum bırakılmışsa) günceller. */
export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("full_name")
        .eq("id", context.userId)
        .maybeSingle();
      const authorName = profile?.full_name?.trim() || "Müşteri";

      const { error } = await context.supabase.from("reviews").upsert(
        {
          restaurant_id: data.restaurantId,
          user_id: context.userId,
          rating: data.rating,
          comment: data.comment?.trim() || null,
          author_name: authorName,
        },
        { onConflict: "restaurant_id,user_id" },
      );
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );

/** Kullanıcının kendi yorumunu siler. */
export const deleteMyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => restaurantIdSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { error } = await context.supabase
        .from("reviews")
        .delete()
        .eq("restaurant_id", data.restaurantId)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );
