-- İşletmeye yeni sipariş: uygulama içi bildirim + e-posta teslim kaydı.
-- Sipariş INSERT'ini değiştirmez. Mevcut orders/RPC/RLS/OTP dokunulmaz.
-- UNIQUE (order_id, channel) aynı sipariş için tekrar bildirim/e-posta yazımını keser.

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

CREATE INDEX IF NOT EXISTS order_vendor_alerts_restaurant_unread_idx
  ON public.order_vendor_alerts (restaurant_id, channel, created_at DESC)
  WHERE read_at IS NULL;

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
