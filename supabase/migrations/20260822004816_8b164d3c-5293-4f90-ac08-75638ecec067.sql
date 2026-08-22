DROP POLICY IF EXISTS "restaurants_public_read" ON public.restaurants;

CREATE POLICY "restaurants_public_read_active" ON public.restaurants
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "restaurants_staff_read_all" ON public.restaurants
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'founder')
    OR public.is_vendor_of(auth.uid(), id)
  );