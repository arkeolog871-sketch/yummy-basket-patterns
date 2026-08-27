import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

/** İşletme cihazının FCM jetonunu kaydeder. restaurant_id istemciden alınmaz. */
export const registerVendorPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ token: z.string().trim().min(20).max(4096) }).parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertVendor } = await import("./vendor.server");
      const restaurantId = await assertVendor(context.supabase, context.userId);
      const token = data.token.trim();
      if (/[\s<>]/.test(token)) throw new Error("Geçersiz cihaz jetonu");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const now = new Date().toISOString();
      await supabaseAdmin.from("vendor_push_tokens").delete().eq("token", token);
      const { error } = await supabaseAdmin.from("vendor_push_tokens").upsert(
        {
          user_id: context.userId,
          restaurant_id: restaurantId,
          token,
          platform: "android",
          updated_at: now,
        },
        { onConflict: "user_id,token" },
      );
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }),
  );
