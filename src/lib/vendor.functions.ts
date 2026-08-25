import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

const vendorStatusSchema = z.enum([
  "confirmed",
  "preparing",
  "on_the_way",
  "delivered",
  "cancelled",
]);

/** Oturumun rolünü ve (varsa) atandığı işletmeyi döner; yönlendirme kararları buna dayanır. */
export const getMyAccessContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { isFounderUser } = await import("./founder.server");
      const { getVendorRestaurantId } = await import("./vendor.server");
      const { isEmailVerified } = await import("./otp.server");
      const [isFounder, restaurantId, emailVerified] = await Promise.all([
        isFounderUser(context.supabase, context.userId),
        getVendorRestaurantId(context.supabase, context.userId),
        isEmailVerified(context.userId),
      ]);
      return {
        isFounder,
        isVendor: Boolean(restaurantId),
        restaurantId,
        emailVerified,
        role: isFounder ? "founder" : restaurantId ? "vendor" : "customer",
      } as const;
    }),
  );

/** İşletme paneli verisi: yalnızca atanan işletmenin kendi kaydı, ürünleri ve siparişleri. */
export const getVendorDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { assertVendor } = await import("./vendor.server");
      const restaurantId = await assertVendor(context.supabase, context.userId);
      const { supabase } = context;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [restaurant, items, orders, categories, media] = await Promise.all([
        supabase
          .from("restaurants")
          .select(
            "id, name, slug, sector, category, delivery_fee, min_order, delivery_minutes, opens_at, closes_at, is_open_manual, is_active, city, district, logo_url, cover_image_url",
          )
          .eq("id", restaurantId)
          .maybeSingle(),
        supabaseAdmin
          .from("menu_items")
          .select(
            "id, name, description, price, is_available, is_popular, category_id, image_url, stock_quantity",
          )
          .eq("restaurant_id", restaurantId)
          .order("name"),
        supabase
          .from("orders")
          .select(
            "id, created_at, status, payment_status, total, subtotal, delivery_fee, recipient_name, phone, street, district, city, note, order_items(id, name, quantity, unit_price)",
          )
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("menu_categories")
          .select("id, name, position")
          .eq("restaurant_id", restaurantId)
          .order("position"),
        supabase
          .from("business_media")
          .select("id, url, kind, position, created_at")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false }),
      ]);

      const firstError =
        restaurant.error ?? items.error ?? orders.error ?? categories.error ?? media.error ?? null;
      if (firstError) throw new Error(firstError.message);
      if (!restaurant.data) throw new Error("Atanan işletme bulunamadı");

      return {
        restaurant: restaurant.data,
        items: items.data ?? [],
        orders: orders.data ?? [],
        categories: categories.data ?? [],
        media: media.data ?? [],
      };
    }),
  );

/** Sipariş durumunu yalnızca siparişin sahibi işletme değiştirebilir. */
export const setVendorOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: vendorStatusSchema }).parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertVendor } = await import("./vendor.server");
      const { audited } = await import("./audit.server");
      const restaurantId = await assertVendor(context.supabase, context.userId);

      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "vendor.order.status",
          entity: "orders",
          entityId: data.id,
          detail: { status: data.status, restaurant_id: restaurantId },
        },
        async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: updated, error } = await supabaseAdmin
            .from("orders")
            .update({ status: data.status })
            .eq("id", data.id)
            .eq("restaurant_id", restaurantId)
            .select("id")
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!updated) throw new Error("Bu sipariş işletmenize ait değil");
          return { ok: true };
        },
      );
    }),
  );

/** Mağazayı anlık açık/kapalı yapar. */
export const setVendorStoreOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ isOpen: z.boolean() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertVendor } = await import("./vendor.server");
      const { audited } = await import("./audit.server");
      const restaurantId = await assertVendor(context.supabase, context.userId);

      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "vendor.store.open",
          entity: "restaurants",
          entityId: restaurantId,
          detail: { is_open_manual: data.isOpen },
        },
        async () => {
          const { error } = await context.supabase
            .from("restaurants")
            .update({ is_open_manual: data.isOpen })
            .eq("id", restaurantId);
          if (error) throw new Error(error.message);
          return { ok: true };
        },
      );
    }),
  );

/** Ürünün stok durumunu (Stokta var / yok) değiştirir. */
export const setVendorItemAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), isAvailable: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertVendor } = await import("./vendor.server");
      const { audited } = await import("./audit.server");
      const restaurantId = await assertVendor(context.supabase, context.userId);

      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "vendor.item.availability",
          entity: "menu_items",
          entityId: data.id,
          detail: { is_available: data.isAvailable },
        },
        async () => {
          const { data: updated, error } = await context.supabase
            .from("menu_items")
            .update({ is_available: data.isAvailable })
            .eq("id", data.id)
            .eq("restaurant_id", restaurantId)
            .select("id")
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!updated) throw new Error("Bu ürün işletmenize ait değil");
          return { ok: true };
        },
      );
    }),
  );
