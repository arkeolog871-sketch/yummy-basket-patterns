import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { runServerFn, toPublicErrorMessage } from "./public-error";
import { isMissingRpcError } from "./rpc-fallback";

const createOrderSchema = z.object({
  restaurant_id: z.string().uuid(),
  items: z
    .array(z.object({ menu_item_id: z.string().uuid(), quantity: z.number().int().min(1).max(20) }))
    .min(1)
    .max(40),
  recipient_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(25),
  city: z.string().trim().min(2).max(60),
  district: z.string().trim().min(2).max(60),
  street: z.string().trim().min(4).max(200),
  directions: z.string().trim().max(300).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
  idempotency_key: z.string().uuid().optional(),
});

type AuthContext = { supabase: SupabaseClient<Database>; userId: string };
type OrderInput = z.infer<typeof createOrderSchema>;

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => createOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    await enforceSensitiveRateLimit("order-create", 20, 60 * 1000);
    try {
      const placed = await placeOrder(data, context);
      return { ok: true as const, ...placed };
    } catch (error) {
      return { ok: false as const, error: toPublicErrorMessage(error) };
    }
  });

async function placeOrder(
  data: OrderInput,
  context: AuthContext,
): Promise<{ id: string; total: number }> {
  const { supabase, userId } = context;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { assertVerifiedEmail } = await import("./otp.server");
  await assertVerifiedEmail(userId);

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, delivery_fee, min_order, is_active, opens_at, closes_at, is_open_manual")
    .eq("id", data.restaurant_id)
    .maybeSingle();
  if (restaurantError) throw new Error(restaurantError.message);
  if (!restaurant || !restaurant.is_active) throw new Error("Restoran şu anda sipariş almıyor.");

  const { isBusinessOpen, closedReason } = await import("./hours");
  if (!isBusinessOpen(restaurant)) throw new Error(closedReason(restaurant));

  const rpc = await supabaseAdmin.rpc("place_customer_order", {
    p_user_id: userId,
    p_restaurant_id: restaurant.id,
    p_items: data.items,
    p_recipient_name: data.recipient_name,
    p_phone: data.phone,
    p_city: data.city,
    p_district: data.district,
    p_street: data.street,
    p_directions: data.directions ?? null,
    p_note: data.note ?? null,
    p_idempotency_key: data.idempotency_key ?? null,
  });

  if (!rpc.error) {
    const result = rpc.data as { ok?: boolean; id?: string; total?: number; error?: string } | null;
    if (result?.ok && result.id && result.total != null) {
      return { id: result.id, total: Number(result.total) };
    }
    throw new Error(result?.error || "Sipariş oluşturulamadı.");
  }
  if (!isMissingRpcError(rpc.error)) {
    throw new Error(rpc.error.message);
  }

  return placeOrderFallback(data, context, restaurant.id);
}

async function placeOrderFallback(
  data: OrderInput,
  context: AuthContext,
  restaurantId: string,
): Promise<{ id: string; total: number }> {
  const { userId } = context;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const ids = data.items.map((item) => item.menu_item_id);
  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from("restaurants")
    .select("id, delivery_fee, min_order, is_active")
    .eq("id", restaurantId)
    .maybeSingle();
  if (restaurantError) throw new Error(restaurantError.message);
  if (!restaurant || !restaurant.is_active) throw new Error("Restoran şu anda sipariş almıyor.");

  const { data: menuItems, error: itemsError } = await supabaseAdmin
    .from("menu_items")
    .select("id, name, price, restaurant_id, is_available, stock_quantity")
    .in("id", ids);
  if (itemsError) throw new Error(itemsError.message);

  const merged = new Map<string, number>();
  for (const line of data.items) {
    merged.set(line.menu_item_id, (merged.get(line.menu_item_id) ?? 0) + line.quantity);
  }
  for (const quantity of merged.values()) {
    if (quantity > 20) throw new Error("Bir üründen en fazla 20 adet sipariş edilebilir.");
  }

  const byId = new Map((menuItems ?? []).map((item) => [item.id, item]));
  let subtotal = 0;
  const orderItems = [...merged.entries()].map(([menuItemId, quantity]) => {
    const item = byId.get(menuItemId);
    if (!item || !item.is_available || item.restaurant_id !== restaurant.id) {
      throw new Error("Sepetteki ürünlerden biri artık geçerli değil.");
    }
    const stock = item.stock_quantity == null ? null : Number(item.stock_quantity);
    if (stock !== null && Number.isFinite(stock) && stock < quantity) {
      throw new Error(`${item.name} için yeterli stok yok.`);
    }
    subtotal += Number(item.price) * quantity;
    return {
      menu_item_id: item.id,
      name: item.name,
      unit_price: Number(item.price),
      quantity,
    };
  });

  if (subtotal < Number(restaurant.min_order)) {
    throw new Error("Minimum sepet tutarına ulaşılmadı.");
  }

  const deliveryFee = Number(restaurant.delivery_fee);
  const total = Number((subtotal + deliveryFee).toFixed(2));

  const insertPayload: Database["public"]["Tables"]["orders"]["Insert"] = {
    user_id: userId,
    restaurant_id: restaurant.id,
    recipient_name: data.recipient_name,
    phone: data.phone,
    city: data.city,
    district: data.district,
    street: data.street,
    directions: data.directions ?? null,
    note: data.note ?? null,
    subtotal: Number(subtotal.toFixed(2)),
    delivery_fee: deliveryFee,
    total,
    status: "confirmed",
    idempotency_key: data.idempotency_key ?? null,
  };

  let order: { id: string } | null = null;
  const firstTry = await supabaseAdmin.from("orders").insert(insertPayload).select("id").single();
  if (firstTry.error && /idempotency_key/i.test(firstTry.error.message)) {
    const { idempotency_key: _ignored, ...withoutKey } = insertPayload;
    const retry = await supabaseAdmin.from("orders").insert(withoutKey).select("id").single();
    if (retry.error) throw new Error(retry.error.message);
    order = retry.data;
  } else if (firstTry.error) {
    throw new Error(firstTry.error.message);
  } else {
    order = firstTry.data;
  }
  if (!order) throw new Error("Sipariş oluşturulamadı.");

  const { error: linesError } = await supabaseAdmin
    .from("order_items")
    .insert(orderItems.map((line) => ({ ...line, order_id: order.id })));
  if (linesError) {
    await supabaseAdmin.from("orders").delete().eq("id", order.id).eq("user_id", userId);
    throw new Error(linesError.message);
  }

  return { id: order.id, total };
}

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { assertVerifiedEmail } = await import("./otp.server");
      await assertVerifiedEmail(context.userId);
      const { data, error } = await context.supabase
        .from("orders")
        .select(
          "id, created_at, status, payment_status, total, restaurants(name, slug, cover_image_url)",
        )
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  );

export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertVerifiedEmail } = await import("./otp.server");
      await assertVerifiedEmail(context.userId);
      const { data: order, error } = await context.supabase
        .from("orders")
        .select(
          "*, restaurants(name, slug, delivery_minutes), order_items(id, name, quantity, unit_price)",
        )
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return order;
    }),
  );
