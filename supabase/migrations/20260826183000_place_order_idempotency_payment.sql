-- Production-safe order placement: add missing columns + atomic RPC.
-- This file is idempotent (IF NOT EXISTS / CREATE OR REPLACE).
--
-- DOES NOT disable RLS, drop existing policies, or open table INSERT/SELECT
-- to anon/public. Execute is service_role only. App uses orders.id (no extra
-- order number column). OTP functions are not replaced.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash_on_delivery';

CREATE UNIQUE INDEX IF NOT EXISTS orders_user_idempotency_key_uidx
  ON public.orders (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.place_customer_order(
  p_user_id uuid,
  p_restaurant_id uuid,
  p_items jsonb,
  p_recipient_name text,
  p_phone text,
  p_city text,
  p_district text,
  p_street text,
  p_directions text,
  p_note text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_item jsonb;
  v_menu public.menu_items%ROWTYPE;
  v_qty integer;
  v_subtotal numeric(10,2) := 0;
  v_total numeric(10,2);
  v_order_id uuid;
  v_existing public.orders%ROWTYPE;
  v_merged jsonb;
  v_id text;
BEGIN
  IF p_user_id IS NULL OR p_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sipariş oluşturulamadı.');
  END IF;

  IF p_idempotency_key IS NOT NULL AND char_length(p_idempotency_key) > 0 THEN
    SELECT * INTO v_existing
    FROM public.orders
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'id', v_existing.id, 'total', v_existing.total);
    END IF;
  END IF;

  SELECT * INTO v_restaurant
  FROM public.restaurants
  WHERE id = p_restaurant_id
  FOR SHARE;
  IF NOT FOUND OR v_restaurant.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Restoran şu anda sipariş almıyor.');
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sepetteki ürünlerden biri artık geçerli değil.');
  END IF;

  v_merged := '{}'::jsonb;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_id := v_item->>'menu_item_id';
    v_qty := COALESCE((v_item->>'quantity')::integer, 0);
    IF v_id IS NULL OR v_qty < 1 OR v_qty > 20 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Sepetteki ürünlerden biri artık geçerli değil.');
    END IF;
    v_merged := jsonb_set(
      v_merged,
      ARRAY[v_id],
      to_jsonb(COALESCE((v_merged->>v_id)::integer, 0) + v_qty)
    );
  END LOOP;

  FOR v_id, v_qty IN SELECT key, value::integer FROM jsonb_each_text(v_merged)
  LOOP
    IF v_qty > 20 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Bir üründen en fazla 20 adet sipariş edilebilir.');
    END IF;

    SELECT * INTO v_menu
    FROM public.menu_items
    WHERE id = v_id::uuid
    FOR UPDATE;

    IF NOT FOUND OR v_menu.restaurant_id IS DISTINCT FROM p_restaurant_id OR v_menu.is_available IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Sepetteki ürünlerden biri artık geçerli değil.');
    END IF;

    IF v_menu.stock_quantity IS NOT NULL AND v_menu.stock_quantity < v_qty THEN
      RETURN jsonb_build_object('ok', false, 'error', v_menu.name || ' için yeterli stok yok.');
    END IF;

    v_subtotal := v_subtotal + (v_menu.price * v_qty);
  END LOOP;

  IF v_subtotal < v_restaurant.min_order THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Minimum sepet tutarına ulaşılmadı.');
  END IF;

  v_total := ROUND((v_subtotal + v_restaurant.delivery_fee)::numeric, 2);

  FOR v_id, v_qty IN SELECT key, value::integer FROM jsonb_each_text(v_merged)
  LOOP
    UPDATE public.menu_items
    SET stock_quantity = stock_quantity - v_qty,
        updated_at = now()
    WHERE id = v_id::uuid
      AND stock_quantity IS NOT NULL;
  END LOOP;

  INSERT INTO public.orders (
    user_id, restaurant_id, recipient_name, phone, city, district, street,
    directions, note, subtotal, delivery_fee, total, status, payment_status,
    payment_method, idempotency_key
  ) VALUES (
    p_user_id, p_restaurant_id, p_recipient_name, p_phone, p_city, p_district, p_street,
    p_directions, p_note, ROUND(v_subtotal::numeric, 2), v_restaurant.delivery_fee, v_total,
    'confirmed', 'unpaid', 'cash_on_delivery', NULLIF(p_idempotency_key, '')
  )
  RETURNING id INTO v_order_id;

  FOR v_id, v_qty IN SELECT key, value::integer FROM jsonb_each_text(v_merged)
  LOOP
    SELECT * INTO v_menu FROM public.menu_items WHERE id = v_id::uuid;
    INSERT INTO public.order_items (order_id, menu_item_id, name, unit_price, quantity)
    VALUES (v_order_id, v_menu.id, v_menu.name, v_menu.price, v_qty);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_order_id, 'total', v_total);
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.orders
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'id', v_existing.id, 'total', v_existing.total);
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.place_customer_order(uuid, uuid, jsonb, text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_customer_order(uuid, uuid, jsonb, text, text, text, text, text, text, text, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
