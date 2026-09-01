-- Gerçek push bildirimleri (Web Push): uygulama/sekme kapalıyken de
-- müşteri, kurucu ve işletmelere bildirim ulaşabilmesi için.
-- Her kullanıcı kendi push aboneliklerini yönetir (RLS); gönderim
-- yalnızca service_role tarafından (push.server.ts) yapılır.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_subscriptions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;

DROP POLICY IF EXISTS push_subscriptions_own_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_select ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_own_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_insert ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_own_update ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_update ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_own_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_delete ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- order_vendor_alerts zaten in_app/email kanallarını tekilleştiriyordu (bkz.
-- 20260826230000_order_vendor_alerts.sql); push kanalını da aynı dedup
-- mekanizmasına (UNIQUE(order_id, channel)) dahil ediyoruz.
ALTER TABLE public.order_vendor_alerts DROP CONSTRAINT IF EXISTS order_vendor_alerts_channel_check;
ALTER TABLE public.order_vendor_alerts
  ADD CONSTRAINT order_vendor_alerts_channel_check CHECK (channel IN ('in_app', 'email', 'push'));
