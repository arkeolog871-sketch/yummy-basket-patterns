-- Sipariş INSERT'i ile aynı transaction'da in-app bildirim satırı.
-- OTP/auth, orders RLS ve mevcut POLICY'lere dokunmaz.
-- UNIQUE (order_id, channel) uygulama tarafı INSERT ile çakışmayı yutar.

CREATE TABLE IF NOT EXISTS public.order_vendor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app', 'email')),
  title text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, channel)
);

ALTER TABLE public.order_vendor_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_vendor_alerts REPLICA IDENTITY FULL;

REVOKE ALL ON TABLE public.order_vendor_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE (read_at) ON TABLE public.order_vendor_alerts TO authenticated;
GRANT ALL ON TABLE public.order_vendor_alerts TO service_role;

DROP POLICY IF EXISTS order_vendor_alerts_vendor_select ON public.order_vendor_alerts;
CREATE POLICY order_vendor_alerts_vendor_select
  ON public.order_vendor_alerts
  FOR SELECT TO authenticated
  USING (public.is_vendor_of(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS order_vendor_alerts_vendor_update_read ON public.order_vendor_alerts;
CREATE POLICY order_vendor_alerts_vendor_update_read
  ON public.order_vendor_alerts
  FOR UPDATE TO authenticated
  USING (
    public.is_vendor_of(auth.uid(), restaurant_id)
    AND channel = 'in_app'
  )
  WITH CHECK (
    public.is_vendor_of(auth.uid(), restaurant_id)
    AND channel = 'in_app'
  );

CREATE OR REPLACE FUNCTION public.trg_order_vendor_alert_in_app()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rest_name text;
BEGIN
  SELECT name INTO rest_name FROM public.restaurants WHERE id = NEW.restaurant_id;
  INSERT INTO public.order_vendor_alerts (
    order_id, restaurant_id, channel, title, body, sent_at
  ) VALUES (
    NEW.id,
    NEW.restaurant_id,
    'in_app',
    'Yeni sipariş',
    concat_ws(
      ' · ',
      COALESCE(NULLIF(btrim(rest_name), ''), 'İşletme'),
      concat('₺', to_char(COALESCE(NEW.total, 0), 'FM999999990.00')),
      COALESCE(NULLIF(btrim(NEW.recipient_name), ''), 'Müşteri')
    ),
    now()
  )
  ON CONFLICT (order_id, channel) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN undefined_table THEN
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_order_vendor_alert_in_app() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_order_vendor_alert_in_app() TO service_role;

DROP TRIGGER IF EXISTS order_vendor_alerts_on_order_insert ON public.orders;
CREATE TRIGGER order_vendor_alerts_on_order_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_order_vendor_alert_in_app();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'order_vendor_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_vendor_alerts;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
