-- Android native uygulama (android-wrapper) WebView içinde Push API'yi
-- desteklemiyor; kapalıyken bildirim için FCM (Firebase Cloud Messaging)
-- token'ları ayrı bir tabloda tutulur. push_subscriptions (Web Push) ile
-- aynı RLS deseni: herkes yalnızca kendi token'ını yönetir, gönderim
-- yalnızca service_role.

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON public.fcm_tokens (user_id);

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fcm_tokens FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.fcm_tokens TO authenticated;
GRANT ALL ON TABLE public.fcm_tokens TO service_role;

DROP POLICY IF EXISTS fcm_tokens_own_select ON public.fcm_tokens;
CREATE POLICY fcm_tokens_own_select ON public.fcm_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS fcm_tokens_own_insert ON public.fcm_tokens;
CREATE POLICY fcm_tokens_own_insert ON public.fcm_tokens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS fcm_tokens_own_delete ON public.fcm_tokens;
CREATE POLICY fcm_tokens_own_delete ON public.fcm_tokens
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
