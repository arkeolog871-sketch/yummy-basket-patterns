-- Production hardening: atomic OTP counters and transactional order placement.
-- Functions are service-role only; authenticated/anon cannot call them.

-- ============ OTP ============

CREATE OR REPLACE FUNCTION public.issue_email_otp(
  p_email_hash text,
  p_code_hash text,
  p_now timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.email_otp_guard%ROWTYPE;
  v_sends integer;
  v_window_start timestamptz;
  v_wait integer;
BEGIN
  IF p_email_hash IS NULL OR char_length(p_email_hash) < 32 OR p_code_hash IS NULL OR char_length(p_code_hash) < 32 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  SELECT * INTO r FROM public.email_otp_guard WHERE email_hash = p_email_hash FOR UPDATE;

  IF FOUND AND r.last_sent_at IS NOT NULL THEN
    v_wait := 60 - FLOOR(EXTRACT(EPOCH FROM (p_now - r.last_sent_at)))::integer;
    IF v_wait > 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'cooldown', 'retry_after', v_wait);
    END IF;
  END IF;

  IF NOT FOUND OR EXTRACT(EPOCH FROM (p_now - r.window_started_at)) >= 3600 THEN
    v_window_start := p_now;
    v_sends := 0;
  ELSE
    v_window_start := r.window_started_at;
    v_sends := r.sends_in_window;
  END IF;

  IF v_sends >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'hourly');
  END IF;

  INSERT INTO public.email_otp_guard (
    email_hash, last_sent_at, window_started_at, sends_in_window,
    failed_attempts, locked_until, code_hash, expires_at, updated_at
  ) VALUES (
    p_email_hash, p_now, v_window_start, v_sends + 1,
    0, NULL, p_code_hash, p_now + interval '10 minutes', p_now
  )
  ON CONFLICT (email_hash) DO UPDATE SET
    last_sent_at = EXCLUDED.last_sent_at,
    window_started_at = EXCLUDED.window_started_at,
    sends_in_window = EXCLUDED.sends_in_window,
    failed_attempts = 0,
    locked_until = NULL,
    code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_email_otp(
  p_email_hash text,
  p_code_hash text,
  p_now timestamptz DEFAULT now()
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.email_otp_guard%ROWTYPE;
BEGIN
  IF p_email_hash IS NULL OR p_code_hash IS NULL THEN
    RETURN 'mismatch';
  END IF;

  SELECT * INTO r FROM public.email_otp_guard WHERE email_hash = p_email_hash FOR UPDATE;
  IF NOT FOUND OR r.code_hash IS NULL THEN
    RETURN 'missing';
  END IF;

  IF (r.expires_at IS NOT NULL AND r.expires_at < p_now)
     OR (r.expires_at IS NULL AND r.last_sent_at IS NOT NULL AND r.last_sent_at < p_now - interval '10 minutes') THEN
    RETURN 'expired';
  END IF;

  IF r.code_hash IS DISTINCT FROM p_code_hash THEN
    RETURN 'mismatch';
  END IF;

  UPDATE public.email_otp_guard
  SET code_hash = NULL,
      expires_at = NULL,
      failed_attempts = 0,
      locked_until = NULL,
      updated_at = p_now
  WHERE email_hash = p_email_hash;

  RETURN 'match';
END;
$$;

CREATE OR REPLACE FUNCTION public.register_email_otp_failure(
  p_email_hash text,
  p_now timestamptz DEFAULT now()
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.email_otp_guard%ROWTYPE;
  v_attempts integer;
BEGIN
  SELECT * INTO r FROM public.email_otp_guard WHERE email_hash = p_email_hash FOR UPDATE;
  v_attempts := COALESCE(r.failed_attempts, 0) + 1;

  IF NOT FOUND THEN
    INSERT INTO public.email_otp_guard (
      email_hash, window_started_at, sends_in_window, failed_attempts, updated_at
    ) VALUES (
      p_email_hash, p_now, 0, v_attempts, p_now
    )
    ON CONFLICT (email_hash) DO UPDATE SET
      failed_attempts = public.email_otp_guard.failed_attempts + 1,
      updated_at = p_now
    RETURNING failed_attempts INTO v_attempts;
    RETURN v_attempts;
  END IF;

  UPDATE public.email_otp_guard
  SET failed_attempts = v_attempts,
      locked_until = CASE WHEN v_attempts >= 5 THEN p_now + interval '15 minutes' ELSE locked_until END,
      code_hash = CASE WHEN v_attempts >= 5 THEN NULL ELSE code_hash END,
      expires_at = CASE WHEN v_attempts >= 5 THEN NULL ELSE expires_at END,
      updated_at = p_now
  WHERE email_hash = p_email_hash;

  RETURN v_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_email_otp(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_email_otp(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_email_otp_failure(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_email_otp(text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_email_otp(text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_email_otp_failure(text, timestamptz) TO service_role;

-- ============ ORDERS ============

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key text;

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

  -- First pass: lock rows, validate, compute totals. Do not write until checks pass
  -- so a min-order/stock failure cannot leave a partial stock decrement committed.
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

    IF v_menu.stock_quantity < v_qty THEN
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
    WHERE id = v_id::uuid;
  END LOOP;

  INSERT INTO public.orders (
    user_id, restaurant_id, recipient_name, phone, city, district, street,
    directions, note, subtotal, delivery_fee, total, status, idempotency_key
  ) VALUES (
    p_user_id, p_restaurant_id, p_recipient_name, p_phone, p_city, p_district, p_street,
    p_directions, p_note, ROUND(v_subtotal::numeric, 2), v_restaurant.delivery_fee, v_total,
    'confirmed', NULLIF(p_idempotency_key, '')
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
