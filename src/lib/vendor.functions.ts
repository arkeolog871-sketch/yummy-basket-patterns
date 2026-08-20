import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .handler(async ({ context }) => {
    const { isFounderUser } = await import("./founder.server");
    const { getVendorRestaurantId } = await import("./vendor.server");
    const [isFounder, restaurantId] = await Promise.all([
      isFounderUser(context.supabase, context.userId),
      getVendorRestaurantId(context.supabase, context.userId),
    ]);
    return {
      isFounder,
      isVendor: Boolean(restaurantId),
      restaurantId,
      role: isFounder ? "founder" : restaurantId ? "vendor" : "customer",
    } as const;
  });

/** İşletme paneli verisi: yalnızca atanan işletmenin kendi kaydı, ürünleri ve siparişleri. */
export const getVendorDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertVendor } = await import("./vendor.server");
    const restaurantId = await assertVendor(context.supabase, context.userId);
    const { supabase } = context;

    const [restaurant, items, orders] = await Promise.all([
      supabase
        .from("restaurants")
        .select(
          "id, name, slug, sector, category, delivery_fee, min_order, delivery_minutes, opens_at, closes_at, is_open_manual, is_active, city, district",
        )
        .eq("id", restaurantId)
        .maybeSingle(),
      supabase
        .from("menu_items")
        .select("id, name, price, is_available, is_popular, category_id")
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
    ]);

    const firstError = restaurant.error ?? items.error ?? orders.error ?? null;
    if (firstError) throw new Error(firstError.message);
    if (!restaurant.data) throw new Error("Atanan işletme bulunamadı");

    return {
      restaurant: restaurant.data,
      items: items.data ?? [],
      orders: orders.data ?? [],
    };
  });

/** Sipariş durumunu yalnızca siparişin sahibi işletme değiştirebilir. */
export const setVendorOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: vendorStatusSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
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
        const { data: updated, error } = await context.supabase
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
  });

/** Mağazayı anlık açık/kapalı yapar. */
export const setVendorStoreOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ isOpen: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
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
  });

/** Ürünün stok durumunu (Stokta var / yok) değiştirir. */
export const setVendorItemAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), isAvailable: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
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
  });
