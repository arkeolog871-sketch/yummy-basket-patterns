ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS secondary_color text NOT NULL DEFAULT '#ffe9d6',
  ADD COLUMN IF NOT EXISTS background_color text NOT NULL DEFAULT '#fff8f0',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS banner_url text;

CREATE TABLE IF NOT EXISTS public.app_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'UtensilsCrossed',
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_categories TO authenticated;
GRANT ALL ON public.app_categories TO service_role;

ALTER TABLE public.app_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_categories_public_read ON public.app_categories
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY app_categories_founder_write ON public.app_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder')) WITH CHECK (public.has_role(auth.uid(), 'founder'));
CREATE POLICY app_categories_admin_write ON public.app_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_categories_set_updated_at BEFORE UPDATE ON public.app_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.service_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city text NOT NULL,
  district text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, district)
);

GRANT SELECT ON public.service_areas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_areas TO authenticated;
GRANT ALL ON public.service_areas TO service_role;

ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_areas_public_read ON public.service_areas
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY service_areas_founder_write ON public.service_areas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder')) WITH CHECK (public.has_role(auth.uid(), 'founder'));
CREATE POLICY service_areas_admin_write ON public.service_areas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER service_areas_set_updated_at BEFORE UPDATE ON public.service_areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_categories (slug, label, icon, position) VALUES
  ('yemek', 'Yemek', 'UtensilsCrossed', 1),
  ('restoran', 'Restoran', 'ChefHat', 2),
  ('kafe', 'Kafe', 'Coffee', 3),
  ('eglence', 'Eğlence', 'PartyPopper', 4),
  ('market', 'Market', 'ShoppingCart', 5),
  ('giyim', 'Giyim', 'Shirt', 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.service_areas (city, district, position) VALUES
  ('İstanbul', 'Kadıköy', 1),
  ('İstanbul', 'Beşiktaş', 2),
  ('Ankara', 'Çankaya', 3),
  ('İzmir', 'Konak', 4),
  ('Bursa', 'Nilüfer', 5),
  ('Antalya', 'Muratpaşa', 6)
ON CONFLICT (city, district) DO NOTHING;