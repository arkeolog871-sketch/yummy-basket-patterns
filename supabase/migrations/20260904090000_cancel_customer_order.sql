-- Müşteri, sipariş verdikten sonraki 4 dakika içinde ve sipariş hâlâ
-- "confirmed" durumundayken siparişini iptal edebilir. Stok, sipariş
-- kalemlerine göre geri yüklenir (yalnızca sınırlı stoklu ürünlerde).
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
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
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

GRANT EXECUTE ON FUNCTION public.cancel_customer_order(uuid, uuid) TO authenticated;
