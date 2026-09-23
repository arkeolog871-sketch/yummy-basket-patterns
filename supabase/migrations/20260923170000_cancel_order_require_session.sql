-- Sipariş iptali oturum ister; anonim çağrı kapalı.
--
-- ÖLÇÜLDÜ (canlı, 23 Eylül 2026): cancel_customer_order anonim çağrıya açıktı.
--  1. Sahiplik denetimi "auth.uid() IS NOT NULL AND ..." idi: oturum yoksa
--     auth.uid() NULL, denetim hiç çalışmıyordu.
--  2. 20260923154256 anon'dan EXECUTE'u geri aldı ama PostgreSQL'in varsayılan
--     PUBLIC yetkisi kaldı (proacl: "=X/postgres"); anon yine çağırabiliyordu.
-- Rastgele kimliklerle yapılan anonim çağrı denetimi geçip "Sipariş
-- bulunamadı." döndürdü. Sipariş ve sahibinin kimliğini bilen biri (kullanıcı
-- kimlikleri yorumlardan herkese açık) ilk 4 dakikada siparişi iptal edebilirdi.
--
-- Tek çağıran: orders.functions.ts → cancelMyOrder (kullanıcı oturumuyla).

CREATE OR REPLACE FUNCTION public.cancel_customer_order(p_order_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz istek.');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sipariş bulunamadı.');
  END IF;
  IF v_order.status <> 'confirmed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bu sipariş artık iptal edilemez.');
  END IF;
  IF v_order.created_at < now() - interval '4 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'İptal süresi (4 dakika) doldu.');
  END IF;

  UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE id = p_order_id;

  FOR v_item IN SELECT menu_item_id, quantity FROM public.order_items WHERE order_id = p_order_id LOOP
    UPDATE public.menu_items
    SET stock_quantity = stock_quantity + v_item.quantity, updated_at = now()
    WHERE id = v_item.menu_item_id AND stock_quantity IS NOT NULL;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_customer_order(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_customer_order(uuid, uuid) TO authenticated, service_role;

