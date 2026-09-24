DROP POLICY IF EXISTS "pi read" ON public.platform_identity;
DROP POLICY IF EXISTS "cs read" ON public.compliance_settings;
DROP POLICY IF EXISTS "dp read" ON public.data_processors;
REVOKE SELECT ON public.platform_identity FROM anon;
REVOKE SELECT ON public.compliance_settings FROM anon;
REVOKE SELECT ON public.data_processors FROM anon;
CREATE POLICY "pi staff read" ON public.platform_identity FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cs staff read" ON public.compliance_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dp staff read" ON public.data_processors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_snapshot jsonb;