-- Sayfa yöneticisinin müşterilere, işletmelere, herkese veya tek bir işletmeye
-- gönderdiği uygulama içi duyuru/mesajlar.

CREATE TABLE IF NOT EXISTS public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('all', 'customers', 'vendors', 'restaurant')),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (target_type = 'restaurant' AND restaurant_id IS NOT NULL)
    OR (target_type <> 'restaurant' AND restaurant_id IS NULL)
  )
);

COMMENT ON TABLE public.admin_messages IS
  'Sayfa yöneticisinin gönderdiği uygulama içi duyuru/mesajlar: tüm müşteriler, tüm işletmeler, herkes veya tek bir işletme hedeflenebilir.';

CREATE INDEX IF NOT EXISTS admin_messages_created_idx
  ON public.admin_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_messages_restaurant_idx
  ON public.admin_messages (restaurant_id)
  WHERE restaurant_id IS NOT NULL;

ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_messages TO authenticated;
GRANT ALL ON TABLE public.admin_messages TO service_role;

DROP POLICY IF EXISTS admin_messages_founder_manage ON public.admin_messages;
CREATE POLICY admin_messages_founder_manage
  ON public.admin_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

DROP POLICY IF EXISTS admin_messages_customer_select ON public.admin_messages;
CREATE POLICY admin_messages_customer_select
  ON public.admin_messages
  FOR SELECT TO authenticated
  USING (target_type IN ('all', 'customers'));

DROP POLICY IF EXISTS admin_messages_vendor_select ON public.admin_messages;
CREATE POLICY admin_messages_vendor_select
  ON public.admin_messages
  FOR SELECT TO authenticated
  USING (
    (target_type IN ('all', 'vendors') AND public.has_role(auth.uid(), 'vendor'))
    OR (target_type = 'restaurant' AND public.is_vendor_of(auth.uid(), restaurant_id))
  );

NOTIFY pgrst, 'reload schema';
