-- Uygulama içi bildirim merkezi + cihaz push token kaydı.
-- Mevcut order_vendor_alerts, orders RPC ve auth yapısına dokunmaz.

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (
    kind IN (
      'order_new_vendor',
      'order_status_customer',
      'admin_broadcast',
      'admin_restaurant',
      'admin_user'
    )
  ),
  title text NOT NULL,
  body text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  route text,
  dedup_key text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS user_notifications_user_unread_idx
  ON public.user_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
  ON public.user_notifications (user_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications REPLICA IDENTITY FULL;

REVOKE ALL ON TABLE public.user_notifications FROM PUBLIC, anon;
GRANT SELECT, UPDATE (read_at) ON TABLE public.user_notifications TO authenticated;
GRANT ALL ON TABLE public.user_notifications TO service_role;

DROP POLICY IF EXISTS user_notifications_self_select ON public.user_notifications;
CREATE POLICY user_notifications_self_select
  ON public.user_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_notifications_self_update_read ON public.user_notifications;
CREATE POLICY user_notifications_self_update_read
  ON public.user_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS device_push_tokens_user_idx
  ON public.device_push_tokens (user_id);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.device_push_tokens FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_push_tokens TO authenticated;
GRANT ALL ON TABLE public.device_push_tokens TO service_role;

DROP POLICY IF EXISTS device_push_tokens_self_all ON public.device_push_tokens;
CREATE POLICY device_push_tokens_self_all
  ON public.device_push_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
