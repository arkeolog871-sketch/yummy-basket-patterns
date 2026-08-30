-- Kurucu toplu bildirim geçmişi + cihaz token tekilliği.
-- Mevcut user_notifications / device_push_tokens / order_vendor_alerts yapısına dokunmaz.

CREATE TABLE IF NOT EXISTS public.notification_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL CHECK (
    audience IN ('all', 'all_customers', 'all_vendors', 'restaurant', 'user')
  ),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sending', 'completed', 'failed')
  ),
  target_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS notification_broadcasts_created_idx
  ON public.notification_broadcasts (created_at DESC);

ALTER TABLE public.notification_broadcasts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_broadcasts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.notification_broadcasts TO service_role;

-- Kurucu geçmişi okuyabilir (yazma yalnızca service_role / sunucu).
GRANT SELECT ON TABLE public.notification_broadcasts TO authenticated;

DROP POLICY IF EXISTS notification_broadcasts_founder_select ON public.notification_broadcasts;
CREATE POLICY notification_broadcasts_founder_select
  ON public.notification_broadcasts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

-- Aynı FCM token birden fazla kullanıcıya bağlanmasın.
CREATE UNIQUE INDEX IF NOT EXISTS device_push_tokens_token_unique
  ON public.device_push_tokens (token);

NOTIFY pgrst, 'reload schema';
