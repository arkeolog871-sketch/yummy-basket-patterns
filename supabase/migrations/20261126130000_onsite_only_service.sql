-- Yerinde hizmet veren işletmeler: dışarıya sipariş/teslimat yapmıyor
-- (oto yıkama, kuaför, usta vb.). Başvuruda "Yerinde hizmet" seçilince
-- teslimat ücreti ve minimum sepet 0'a sabitlenir, müşteri tarafında
-- sipariş/sepet akışı tamamen gizlenir — "sipariş verilemeyeceği" net olsun.
--
-- Mevcut kayıtlar değişmez: varsayılan false (dışarıya sipariş/teslimat var).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS onsite_only boolean NOT NULL DEFAULT false;

ALTER TABLE public.business_applications
  ADD COLUMN IF NOT EXISTS onsite_only boolean NOT NULL DEFAULT false;

-- restaurants sütun bazlı okunuyor: yeni sütun vitrine açık olmalı, yoksa
-- işletme listesi sorgusu "permission denied" ile düşer.
GRANT SELECT (onsite_only) ON public.restaurants TO anon, authenticated;

-- place_customer_order'a yerinde-hizmet reddi eklenir (is_active kontrolünün
-- hemen ardından); istemci tarafı sepete eklemeyi zaten engelliyor, bu sunucu
-- tarafında kesin bir kapı — bozuk/kötü niyetli istemci bu işletmeye sipariş
-- geçiremesin.
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
  v_delivery numeric(10,2);
  v_total numeric(10,2);
  v_order_id uuid;
  v_existing public.orders%ROWTYPE;
  v_merged jsonb;
  v_id text;
  v_idem text;
  v_now_min integer;
  v_open_min integer;
  v_close_min integer;
  v_open_ok boolean;
  v_updated integer;
  v_item_name text;
BEGIN
  -- authenticated JWT varsa p_user_id sahibi olmak zorunda.
  -- service_role (createOrder / supabaseAdmin) için auth.uid() NULL'dır; o yol bozulmaz.
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz sipariş isteği.');
  END IF;

  IF p_user_id IS NULL OR p_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sipariş oluşturulamadı.');
  END IF;

  v_idem := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');

  IF v_idem IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext('place_customer_order:' || p_user_id::text),
      hashtext(v_idem)
    );

    SELECT * INTO v_existing
    FROM public.orders
    WHERE user_id = p_user_id AND idempotency_key = v_idem;
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

  IF v_restaurant.onsite_only IS TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bu işletme sipariş almıyor, yalnızca yerinde hizmet veriyor.');
  END IF;

  -- hours.ts ile aynı kural: is_open_manual=false kapalı; null/eşit saat açık;
  -- gece yarısını aşan aralık; Europe/Istanbul.
  IF v_restaurant.is_open_manual IS FALSE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'İşletme siparişleri geçici olarak durdurdu.');
  END IF;

  IF v_restaurant.opens_at IS NULL
     OR v_restaurant.closes_at IS NULL
     OR v_restaurant.opens_at IS NOT DISTINCT FROM v_restaurant.closes_at THEN
    v_open_ok := true;
  ELSE
    v_now_min := (
      EXTRACT(HOUR FROM (timezone('Europe/Istanbul', now()))::time) * 60
      + EXTRACT(MINUTE FROM (timezone('Europe/Istanbul', now()))::time)
    )::integer;
    v_open_min := (
      EXTRACT(HOUR FROM v_restaurant.opens_at) * 60
      + EXTRACT(MINUTE FROM v_restaurant.opens_at)
    )::integer;
    v_close_min := (
      EXTRACT(HOUR FROM v_restaurant.closes_at) * 60
      + EXTRACT(MINUTE FROM v_restaurant.closes_at)
    )::integer;
    IF v_close_min > v_open_min THEN
      v_open_ok := (v_now_min >= v_open_min AND v_now_min < v_close_min);
    ELSE
      v_open_ok := (v_now_min >= v_open_min OR v_now_min < v_close_min);
    END IF;
  END IF;

  IF NOT v_open_ok THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'Şu an kapalı. Çalışma saatleri: '
        || to_char(v_restaurant.opens_at, 'HH24:MI')
        || ' - '
        || to_char(v_restaurant.closes_at, 'HH24:MI')
        || '.'
    );
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) < 1
     OR jsonb_array_length(p_items) > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sepetteki ürünlerden biri artık geçerli değil.');
  END IF;

  v_merged := '{}'::jsonb;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_id := v_item->>'menu_item_id';
    BEGIN
      v_qty := COALESCE((v_item->>'quantity')::integer, 0);
    EXCEPTION
      WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Sepetteki ürünlerden biri artık geçerli değil.');
    END;
    IF v_id IS NULL OR v_qty < 1 OR v_qty > 20 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Sepetteki ürünlerden biri artık geçerli değil.');
    END IF;
    BEGIN
      PERFORM v_id::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Sepetteki ürünlerden biri artık geçerli değil.');
    END;
    v_merged := jsonb_set(
      v_merged,
      ARRAY[v_id],
      to_jsonb(COALESCE((v_merged->>v_id)::integer, 0) + v_qty)
    );
  END LOOP;

  -- 1. geçiş: satır kilidi, restoran aidiyeti, DB fiyatı. İstemci fiyatı/teslimat ücreti yok.
  FOR v_id, v_qty IN SELECT key, value::integer FROM jsonb_each_text(v_merged)
  LOOP
    IF v_qty > 20 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Bir üründen en fazla 20 adet sipariş edilebilir.');
    END IF;

    SELECT * INTO v_menu
    FROM public.menu_items
    WHERE id = v_id::uuid
    FOR UPDATE;

    IF NOT FOUND
       OR v_menu.restaurant_id IS DISTINCT FROM p_restaurant_id
       OR v_menu.is_available IS NOT TRUE THEN
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

  v_delivery := v_restaurant.delivery_fee;
  v_total := ROUND((v_subtotal + v_delivery)::numeric, 2);

  -- 2. geçiş: stok. plpgsql fonksiyonu tek transaction; başarısızlık tüm işi geri alır.
  FOR v_id, v_qty IN SELECT key, value::integer FROM jsonb_each_text(v_merged)
  LOOP
    UPDATE public.menu_items
    SET stock_quantity = stock_quantity - v_qty,
        updated_at = now()
    WHERE id = v_id::uuid
      AND restaurant_id = p_restaurant_id
      AND stock_quantity >= v_qty;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      SELECT name INTO v_item_name FROM public.menu_items WHERE id = v_id::uuid;
      -- RETURN burada stok UPDATE'ini commit eder; RAISE tüm transaction'ı geri alır.
      RAISE EXCEPTION '% için yeterli stok yok.', COALESCE(v_item_name, 'Ürün');
    END IF;
  END LOOP;

  INSERT INTO public.orders (
    user_id, restaurant_id, recipient_name, phone, city, district, street,
    directions, note, subtotal, delivery_fee, total, status, payment_status,
    payment_method, idempotency_key
  ) VALUES (
    p_user_id, p_restaurant_id, p_recipient_name, p_phone, p_city, p_district, p_street,
    p_directions, p_note, ROUND(v_subtotal::numeric, 2), v_delivery, v_total,
    'confirmed', 'unpaid', 'cash_on_delivery', v_idem
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
    WHERE user_id = p_user_id AND idempotency_key = v_idem;
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
