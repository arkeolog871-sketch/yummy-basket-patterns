import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { runServerFn, toPublicErrorMessage } from "./public-error";
import { planStockDecrement } from "./orders-stock";
import {
  isMissingRpcError,
  shouldRetryPlaceOrderRpcWithServiceRole,
  shouldUseOrderPlacementFallback,
} from "./rpc-fallback";
import {
  CASH_ON_DELIVERY_PAYMENT_METHOD,
  createOrderSchema,
  insertOmittingUnknownColumns,
  isUnknownOrderColumnError,
  logOrderFailure,
  withOrderIdempotencyLock,
  type CreateOrderInput,
} from "./order-placement";

type AuthContext = { supabase: SupabaseClient<Database>; userId: string };

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => createOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    await enforceSensitiveRateLimit("order-create", 20, 60 * 1000);
    try {
      const placed = await withOrderIdempotencyLock(context.userId, data.idempotency_key, () =>
        placeOrder(data, context),
      );
      try {
        const { finishPlacedOrder } = await import("./order-vendor-alert.server");
        return await finishPlacedOrder(placed);
      } catch {
        console.error("[order-vendor-alert] bildirim başlatılamadı", { orderId: placed.id });
        return { ok: true as const, ...placed };
      }
    } catch (error) {
      logOrderFailure({
        stage: "createOrder",
        userId: context.userId,
        restaurantId: data.restaurant_id,
        error,
      });
      return { ok: false as const, error: toPublicErrorMessage(error) };
    }
  });

async function placeOrder(
  data: CreateOrderInput,
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
  if (restaurantError) {
    logOrderFailure({
      stage: "restaurants.select",
      userId,
      restaurantId: data.restaurant_id,
      error: restaurantError,
    });
    throw new Error(restaurantError.message);
  }
  if (!restaurant || !restaurant.is_active) throw new Error("Restoran şu anda sipariş almıyor.");

  const { isBusinessOpen, closedReason } = await import("./hours");
  if (!isBusinessOpen(restaurant)) throw new Error(closedReason(restaurant));

  // Opsiyonel alanlar SQL tarafında NULL kabul ediyor; üretilen tipler bunları string olarak görüyor.
  const rpcArgs = {
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
  };
  // Oturum JWT'si (role=authenticated). p_user_id = claims.sub; fonksiyon auth.uid() ile doğrular.
  // EXECUTE yoksa veya PostgREST fonksiyonu bu role göstermiyorsa service_role dener.
  let rpc = await supabase.rpc("place_customer_order", rpcArgs);
  if (rpc.error && shouldRetryPlaceOrderRpcWithServiceRole(rpc.error)) {
    logOrderFailure({
      stage: "place_customer_order.authenticated_rpc",
      userId,
      restaurantId: restaurant.id,
      error: rpc.error,
    });
    rpc = await supabaseAdmin.rpc("place_customer_order", rpcArgs);
  }

  if (!rpc.error) {
    const result = rpc.data as { ok?: boolean; id?: string; total?: number; error?: string } | null;
    if (result?.ok && result.id && result.total != null) {
      return { id: result.id, total: Number(result.total) };
    }
    logOrderFailure({
      stage: "place_customer_order.result",
      userId,
      restaurantId: restaurant.id,
      error: result?.error || "Sipariş oluşturulamadı.",
    });
    throw new Error(result?.error || "Sipariş oluşturulamadı.");
  }
  if (!shouldUseOrderPlacementFallback(rpc.error)) {
    logOrderFailure({
      stage: "place_customer_order.rpc",
      userId,
      restaurantId: restaurant.id,
      error: rpc.error,
    });
    throw new Error(rpc.error.message);
  }

  logOrderFailure({
    stage: isMissingRpcError(rpc.error)
      ? "place_customer_order.missing_rpc_fallback"
      : "place_customer_order.schema_mismatch_fallback",
    userId,
    restaurantId: restaurant.id,
    error: rpc.error,
  });
  return placeOrderFallback(data, context, restaurant.id);
}

async function findIdempotentOrder(
  userId: string,
  key: string,
): Promise<{ id: string; total: number } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, total")
    .eq("user_id", userId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) {
    if (isUnknownOrderColumnError(error, "idempotency_key")) return null;
    throw new Error(error.message);
  }
  if (!data?.id) return null;
  return { id: data.id, total: Number(data.total) };
}

async function insertOrderRow(payload: Record<string, unknown>): Promise<{
  data: { id: string } | null;
  error: { message: string; code?: string } | null;
  duplicate: boolean;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return insertOmittingUnknownColumns(
    async (row) => {
      const result = await supabaseAdmin.from("orders").insert(row as never).select("id").single();
      return { data: result.data, error: result.error };
    },
    payload,
    {
      onOmit: (column) => {
        console.warn("[order-create]", {
          endpoint: "createOrder",
          stage: "orders.insert.omit_column",
          column,
        });
      },
    },
  );
}

async function restoreStockSnapshots(rows: Array<{ id: string; previous: number }>): Promise<void> {
  if (rows.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (const row of rows) {
    await supabaseAdmin
      .from("menu_items")
      .update({ stock_quantity: row.previous })
      .eq("id", row.id);
  }
}

async function placeOrderFallback(
  data: CreateOrderInput,
  context: AuthContext,
  restaurantId: string,
): Promise<{ id: string; total: number }> {
  const { userId } = context;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (data.idempotency_key) {
    const existing = await findIdempotentOrder(userId, data.idempotency_key);
    if (existing) return existing;
  }

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
    const plan = planStockDecrement(item.stock_quantity, quantity);
    if (!plan.ok) throw new Error(`${item.name} için yeterli stok yok.`);
    subtotal += Number(item.price) * quantity;
    return {
      menu_item_id: item.id,
      name: item.name,
      unit_price: Number(item.price),
      quantity,
      stockPlan: plan,
      previousStock:
        item.stock_quantity == null || !Number.isFinite(Number(item.stock_quantity))
          ? null
          : Number(item.stock_quantity),
    };
  });

  if (subtotal < Number(restaurant.min_order)) {
    throw new Error("Minimum sepet tutarına ulaşılmadı.");
  }

  const deliveryFee = Number(restaurant.delivery_fee);
  const total = Number((subtotal + deliveryFee).toFixed(2));
  const decremented: Array<{ id: string; previous: number }> = [];

  try {
    for (const line of orderItems) {
      if (!("next" in line.stockPlan) || line.previousStock == null) continue;
      const { data: updated, error: stockError } = await supabaseAdmin
        .from("menu_items")
        .update({ stock_quantity: line.stockPlan.next })
        .eq("id", line.menu_item_id)
        .eq("restaurant_id", restaurant.id)
        .gte("stock_quantity", line.quantity)
        .select("id")
        .maybeSingle();
      if (stockError) throw new Error(stockError.message);
      if (!updated) throw new Error(`${line.name} için yeterli stok yok.`);
      decremented.push({ id: line.menu_item_id, previous: line.previousStock });
    }

    const insertPayload: Record<string, unknown> = {
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
      payment_status: "unpaid",
      payment_method: CASH_ON_DELIVERY_PAYMENT_METHOD,
      idempotency_key: data.idempotency_key ?? null,
    };

    const firstTry = await insertOrderRow(insertPayload);
    if (firstTry.duplicate && data.idempotency_key) {
      await restoreStockSnapshots(decremented);
      const existing = await findIdempotentOrder(userId, data.idempotency_key);
      if (existing) return existing;
      throw new Error("Sipariş oluşturulamadı.");
    }
    if (firstTry.error) {
      logOrderFailure({
        stage: "orders.insert",
        userId,
        restaurantId: restaurant.id,
        error: firstTry.error,
      });
      throw new Error(firstTry.error.message);
    }
    const order = firstTry.data;
    if (!order) throw new Error("Sipariş oluşturulamadı.");

    const { error: linesError } = await supabaseAdmin.from("order_items").insert(
      orderItems.map((line) => ({
        order_id: order.id,
        menu_item_id: line.menu_item_id,
        name: line.name,
        unit_price: line.unit_price,
        quantity: line.quantity,
      })),
    );
    if (linesError) {
      logOrderFailure({
        stage: "order_items.insert",
        userId,
        restaurantId: restaurant.id,
        orderId: order.id,
        error: linesError,
      });
      await supabaseAdmin.from("orders").delete().eq("id", order.id).eq("user_id", userId);
      throw new Error(linesError.message);
    }

    return { id: order.id, total };
  } catch (error) {
    await restoreStockSnapshots(decremented);
    throw error;
  }
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
