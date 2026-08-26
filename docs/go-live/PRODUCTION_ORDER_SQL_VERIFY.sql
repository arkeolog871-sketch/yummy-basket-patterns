-- READ ONLY. Production SQL Editor'da migration'dan SONRA çalıştırın.
-- Sipariş INSERT/UPDATE yok. RLS değiştirilmez.
-- Beklenen:
--   orders.idempotency_key  text, nullable
--   orders.payment_method   text, NOT NULL, default cash_on_delivery
--   place_customer_order(uuid, uuid, jsonb, text, text, text, text, text, text, text, text)
--   anon/authenticated EXECUTE = false
--   service_role EXECUTE = true
--   anon INSERT on orders = false
--   RLS on orders and order_items = true

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN (
    'idempotency_key',
    'payment_method',
    'payment_status',
    'subtotal',
    'delivery_fee',
    'total',
    'user_id',
    'restaurant_id',
    'recipient_name',
    'phone',
    'street',
    'district',
    'city'
  )
ORDER BY column_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_items'
  AND column_name IN ('id', 'order_id', 'menu_item_id', 'name', 'quantity', 'unit_price')
ORDER BY column_name;

SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'place_customer_order';

SELECT
  has_function_privilege(
    'anon',
    'public.place_customer_order(uuid,uuid,jsonb,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ) AS anon_exec,
  has_function_privilege(
    'authenticated',
    'public.place_customer_order(uuid,uuid,jsonb,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ) AS authenticated_exec,
  has_function_privilege(
    'service_role',
    'public.place_customer_order(uuid,uuid,jsonb,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ) AS service_role_exec,
  has_table_privilege('anon', 'public.orders', 'INSERT') AS anon_orders_insert,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.orders'::regclass) AS orders_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.order_items'::regclass) AS order_items_rls;
