DROP POLICY IF EXISTS "cr read" ON public.commission_rules;
REVOKE SELECT ON public.commission_rules FROM anon;
CREATE POLICY "cr read founder admin" ON public.commission_rules FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'founder'));