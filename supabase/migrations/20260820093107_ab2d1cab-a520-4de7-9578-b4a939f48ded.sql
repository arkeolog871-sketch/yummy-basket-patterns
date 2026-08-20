-- Site-wide appearance settings, managed by the founder
CREATE TABLE public.site_settings (
  id text PRIMARY KEY DEFAULT 'global',
  brand_name text NOT NULL DEFAULT 'SofraKapımda',
  primary_color text NOT NULL DEFAULT '#ff8c42',
  accent_color text NOT NULL DEFAULT '#e63946',
  theme_mode text NOT NULL DEFAULT 'light',
  layout_variant text NOT NULL DEFAULT 'classic',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_settings_public_read ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY site_settings_founder_write ON public.site_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE TRIGGER site_settings_set_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.site_settings (id) VALUES ('global')
  ON CONFLICT (id) DO NOTHING;

-- Founder gets full control over catalog, orders, users and roles
CREATE POLICY restaurants_founder_write ON public.restaurants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE POLICY menu_categories_founder_write ON public.menu_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE POLICY menu_items_founder_write ON public.menu_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE POLICY orders_founder_select ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'founder'));

CREATE POLICY orders_founder_update ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE POLICY order_items_founder_select ON public.order_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'founder'));

CREATE POLICY profiles_founder_select ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'founder'));

CREATE POLICY profiles_founder_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE POLICY user_roles_founder_manage ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));