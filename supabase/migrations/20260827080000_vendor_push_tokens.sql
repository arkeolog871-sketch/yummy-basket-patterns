-- İşletme cihaz FCM jetonları. orders tablosuna ve sipariş RPC/RLS'ye dokunmaz.
CREATE TABLE IF NOT EXISTS public.vendor_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'android',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS vendor_push_tokens_restaurant_idx
  ON public.vendor_push_tokens (restaurant_id, updated_at DESC);

ALTER TABLE public.vendor_push_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vendor_push_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendor_push_tokens TO authenticated;
GRANT ALL ON TABLE public.vendor_push_tokens TO service_role;

DROP POLICY IF EXISTS vendor_push_tokens_own_select ON public.vendor_push_tokens;
CREATE POLICY vendor_push_tokens_own_select
  ON public.vendor_push_tokens
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND public.is_vendor_of(auth.uid(), restaurant_id)
  );

DROP POLICY IF EXISTS vendor_push_tokens_own_insert ON public.vendor_push_tokens;
CREATE POLICY vendor_push_tokens_own_insert
  ON public.vendor_push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_vendor_of(auth.uid(), restaurant_id)
  );

DROP POLICY IF EXISTS vendor_push_tokens_own_update ON public.vendor_push_tokens;
CREATE POLICY vendor_push_tokens_own_update
  ON public.vendor_push_tokens
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND public.is_vendor_of(auth.uid(), restaurant_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_vendor_of(auth.uid(), restaurant_id)
  );

DROP POLICY IF EXISTS vendor_push_tokens_own_delete ON public.vendor_push_tokens;
CREATE POLICY vendor_push_tokens_own_delete
  ON public.vendor_push_tokens
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND public.is_vendor_of(auth.uid(), restaurant_id)
  );

NOTIFY pgrst, 'reload schema';
