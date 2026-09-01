CREATE TABLE public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('all','customers','vendors','restaurant')),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_messages_created_at_idx ON public.admin_messages (created_at DESC);
CREATE INDEX admin_messages_restaurant_idx ON public.admin_messages (restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_messages TO authenticated;
GRANT ALL ON public.admin_messages TO service_role;

ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage admin messages"
  ON public.admin_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Recipients read their admin messages"
  ON public.admin_messages FOR SELECT TO authenticated
  USING (
    target_type IN ('all','customers')
    OR (target_type = 'vendors' AND EXISTS (
      SELECT 1 FROM public.vendor_assignments va WHERE va.user_id = auth.uid()
    ))
    OR (target_type = 'restaurant' AND restaurant_id IS NOT NULL
        AND public.is_vendor_of(auth.uid(), restaurant_id))
  );

CREATE TRIGGER admin_messages_set_updated_at
  BEFORE UPDATE ON public.admin_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();