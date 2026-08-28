import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

/** Yalnızca oturumdaki işletmenin kendi sipariş özetini döner. Service-role istemciye inmez. */
export const getVendorMobileOrderAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertVendor } = await import("./vendor.server");
      const restaurantId = await assertVendor(context.supabase, context.userId);
      const { data: order, error } = await context.supabase
        .from("orders")
        .select("id, total, restaurant_id, order_items(name, quantity)")
        .eq("id", data.orderId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!order) return null;
      return {
        orderId: order.id,
        total: Number(order.total),
        items: (order.order_items ?? []).map((line) => ({
          name: line.name,
          quantity: Number(line.quantity),
        })),
      };
    }),
  );
