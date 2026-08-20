CREATE TABLE IF NOT EXISTS public.vendor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vendor_assignments TO authenticated;
GRANT ALL ON public.vendor_assignments TO service_role;
ALTER TABLE public.vendor_assignments ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS vendor_assignments_set_updated_at ON public.vendor_assignments;
CREATE TRIGGER vendor_assignments_set_updated_at BEFORE UPDATE ON public.vendor_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.vendor_restaurant_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT restaurant_id FROM public.vendor_assignments WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_vendor_of(_user_id uuid, _restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_assignments
    WHERE user_id = _user_id AND restaurant_id = _restaurant_id
  );
$$;

DROP POLICY IF EXISTS vendor_assignments_select_own ON public.vendor_assignments;
CREATE POLICY vendor_assignments_select_own ON public.vendor_assignments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS vendor_assignments_founder_manage ON public.vendor_assignments;
CREATE POLICY vendor_assignments_founder_manage ON public.vendor_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder')) WITH CHECK (public.has_role(auth.uid(), 'founder'));

DROP POLICY IF EXISTS restaurants_vendor_update_own ON public.restaurants;
CREATE POLICY restaurants_vendor_update_own ON public.restaurants
  FOR UPDATE TO authenticated
  USING (public.is_vendor_of(auth.uid(), id)) WITH CHECK (public.is_vendor_of(auth.uid(), id));

DROP POLICY IF EXISTS menu_items_vendor_update_own ON public.menu_items;
CREATE POLICY menu_items_vendor_update_own ON public.menu_items
  FOR UPDATE TO authenticated
  USING (public.is_vendor_of(auth.uid(), restaurant_id))
  WITH CHECK (public.is_vendor_of(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS orders_vendor_select ON public.orders;
CREATE POLICY orders_vendor_select ON public.orders
  FOR SELECT TO authenticated USING (public.is_vendor_of(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS orders_vendor_update ON public.orders;
CREATE POLICY orders_vendor_update ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_vendor_of(auth.uid(), restaurant_id))
  WITH CHECK (public.is_vendor_of(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS order_items_vendor_select ON public.order_items;
CREATE POLICY order_items_vendor_select ON public.order_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND public.is_vendor_of(auth.uid(), o.restaurant_id)
  ));