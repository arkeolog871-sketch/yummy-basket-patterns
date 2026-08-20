import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
});

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, delivery_fee, min_order, is_active, opens_at, closes_at, is_open_manual")
      .eq("id", data.restaurant_id)
      .maybeSingle();
    if (restaurantError) throw new Error(restaurantError.message);
    if (!restaurant || !restaurant.is_active) throw new Error("Restoran şu anda sipariş almıyor.");

    const { isBusinessOpen, closedReason } = await import("./hours");
    if (!isBusinessOpen(restaurant)) throw new Error(closedReason(restaurant));

    const ids = data.items.map((item) => item.menu_item_id);
    const { data: menuItems, error: itemsError } = await supabase
      .from("menu_items")
      .select("id, name, price, restaurant_id, is_available")
      .in("id", ids);
    if (itemsError) throw new Error(itemsError.message);

    const byId = new Map((menuItems ?? []).map((item) => [item.id, item]));
    let subtotal = 0;
    const orderItems = data.items.map((line) => {
      const item = byId.get(line.menu_item_id);
      if (!item || !item.is_available || item.restaurant_id !== restaurant.id) {
        throw new Error("Sepetteki ürünlerden biri artık geçerli değil.");
      }
      subtotal += Number(item.price) * line.quantity;
      return {
        menu_item_id: item.id,
        name: item.name,
        unit_price: Number(item.price),
        quantity: line.quantity,
      };
    });

    if (subtotal < Number(restaurant.min_order)) {
      throw new Error("Minimum sepet tutarına ulaşılmadı.");
    }

    const deliveryFee = Number(restaurant.delivery_fee);
    const total = Number((subtotal + deliveryFee).toFixed(2));

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
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
      })
      .select("id")
      .single();
    if (orderError) throw new Error(orderError.message);

    const { error: linesError } = await supabase
      .from("order_items")
      .insert(orderItems.map((line) => ({ ...line, order_id: order.id })));
    if (linesError) throw new Error(linesError.message);

    return { id: order.id, total };
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, created_at, status, payment_status, total, restaurants(name, slug, cover_image_url)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*, restaurants(name, slug, delivery_minutes), order_items(id, name, quantity, unit_price)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return order;
  });