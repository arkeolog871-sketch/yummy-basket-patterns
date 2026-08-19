-- ============ enums ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'preparing', 'on_the_way', 'delivered', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'failed', 'refunded');

-- ============ shared trigger fn ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ user_roles ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_roles_admin_select_all" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ profile auto-create ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ addresses ============
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  street TEXT NOT NULL,
  district TEXT NOT NULL,
  city TEXT NOT NULL,
  directions TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses_manage_own" ON public.addresses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER addresses_set_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_single_default_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.addresses
      SET is_default = false
      WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER addresses_single_default AFTER INSERT OR UPDATE OF is_default ON public.addresses FOR EACH ROW WHEN (NEW.is_default) EXECUTE FUNCTION public.enforce_single_default_address();

-- ============ restaurants ============
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  category TEXT NOT NULL,
  cuisines TEXT[] NOT NULL DEFAULT '{}',
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  delivery_minutes INTEGER NOT NULL DEFAULT 30,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order NUMERIC(10,2) NOT NULL DEFAULT 0,
  cover_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurants_public_read" ON public.restaurants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "restaurants_admin_write" ON public.restaurants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER restaurants_set_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ menu_categories ============
CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
GRANT ALL ON public.menu_categories TO service_role;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_categories_public_read" ON public.menu_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "menu_categories_admin_write" ON public.menu_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ menu_items ============
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_items_public_read" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "menu_items_admin_write" ON public.menu_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER menu_items_set_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ orders ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  payment_reference TEXT,
  subtotal NUMERIC(10,2) NOT NULL,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  street TEXT NOT NULL,
  district TEXT NOT NULL,
  city TEXT NOT NULL,
  directions TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_own" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "orders_insert_own" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_admin_select" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "orders_admin_update" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ order_items ============
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select_own" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "order_items_insert_own" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "order_items_admin_select" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_menu_items_restaurant ON public.menu_items(restaurant_id);
CREATE INDEX idx_menu_categories_restaurant ON public.menu_categories(restaurant_id);
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- ============ seed restaurants ============
INSERT INTO public.restaurants (slug, name, tagline, category, cuisines, rating, review_count, delivery_minutes, delivery_fee, min_order, cover_image_url) VALUES
('ocakbasi-dukkani', 'Ocakbaşı Dükkanı', 'Meşe kömüründe, elde çekilmiş köfte ve kebap', 'Kebap', ARRAY['Kebap','Izgara','Türk Mutfağı'], 4.7, 1284, 35, 14.90, 150.00, '/images/restaurants/ocakbasi-dukkani.jpg'),
('pizza-forno', 'Pizza Forno', 'Taş fırında 48 saat mayalanmış hamur', 'Pizza', ARRAY['Pizza','İtalyan'], 4.6, 2043, 30, 9.90, 120.00, '/images/restaurants/pizza-forno.jpg'),
('burger-atolyesi', 'Burger Atölyesi', 'Günlük çekilmiş dana eti, brioche ekmek', 'Burger', ARRAY['Burger','Amerikan','Fast Food'], 4.8, 3120, 25, 0.00, 140.00, '/images/restaurants/burger-atolyesi.jpg'),
('cig-kofteci-ali-usta', 'Çiğ Köfteci Ali Usta', 'Etsiz çiğ köfte, bol nar ekşili', 'Çiğ Köfte', ARRAY['Çiğ Köfte','Türk Mutfağı'], 4.5, 876, 20, 7.90, 80.00, '/images/restaurants/cig-kofteci-ali-usta.jpg'),
('anne-mutfagi', 'Anne Mutfağı', 'Her gün taze pişen ev yemekleri', 'Ev Yemeği', ARRAY['Ev Yemeği','Çorba','Türk Mutfağı'], 4.9, 1567, 40, 12.90, 100.00, '/images/restaurants/anne-mutfagi.jpg'),
('tatli-kacamak', 'Tatlı Kaçamak', 'Fıstıklı baklava ve sütlü tatlılar', 'Tatlı', ARRAY['Tatlı','Baklava','Pasta'], 4.7, 992, 30, 11.90, 90.00, '/images/restaurants/tatli-kacamak.jpg'),
('balikci-reis', 'Balıkçı Reis', 'Günün balığı, mezeler ve deniz ürünleri', 'Deniz Ürünleri', ARRAY['Balık','Deniz Ürünleri','Meze'], 4.4, 604, 45, 19.90, 220.00, '/images/restaurants/balikci-reis.jpg'),
('lahmacun-evi', 'Lahmacun Evi', 'İnce hamur, odun ateşi lahmacun ve pide', 'Lahmacun', ARRAY['Lahmacun','Pide','Türk Mutfağı'], 4.6, 1749, 30, 8.90, 110.00, '/images/restaurants/lahmacun-evi.jpg');

-- ============ seed menus ============
-- Ocakbaşı Dükkanı
WITH r AS (SELECT id FROM public.restaurants WHERE slug = 'ocakbasi-dukkani'),
c1 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Izgaralar', 1 FROM r RETURNING id, restaurant_id),
c2 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Başlangıçlar', 2 FROM r RETURNING id, restaurant_id),
c3 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'İçecekler', 3 FROM r RETURNING id, restaurant_id)
INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price, is_popular)
SELECT restaurant_id, id, 'Adana Kebap', 'Zırhla çekilmiş kuzu eti, bulgur pilavı ve közlenmiş biber ile', 245.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Kuzu Şiş', 'Marine edilmiş kuzu kuşbaşı, lavaş üzerinde', 289.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Tavuk Kanat', 'Baharatlı marinasyon, 6 adet', 179.00, false FROM c1
UNION ALL SELECT restaurant_id, id, 'İçli Köfte', 'El yapımı, 2 adet', 89.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Ezme Salata', 'Acılı, bol maydanozlu', 59.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Şalgam Suyu', 'Acılı veya acısız', 35.00, false FROM c3
UNION ALL SELECT restaurant_id, id, 'Ayran', 'Yayık ayran, 300 ml', 29.00, false FROM c3;

-- Pizza Forno
WITH r AS (SELECT id FROM public.restaurants WHERE slug = 'pizza-forno'),
c1 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Pizzalar', 1 FROM r RETURNING id, restaurant_id),
c2 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Yan Lezzetler', 2 FROM r RETURNING id, restaurant_id),
c3 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'İçecekler', 3 FROM r RETURNING id, restaurant_id)
INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price, is_popular)
SELECT restaurant_id, id, 'Margherita', 'San Marzano domates, fior di latte, taze fesleğen', 179.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Diavola', 'Acı sucuk, mozzarella, kekik', 219.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Quattro Formaggi', 'Dört çeşit peynir, ceviz', 239.00, false FROM c1
UNION ALL SELECT restaurant_id, id, 'Sarımsaklı Ekmek', 'Fırında, parmesanlı', 69.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Sezar Salata', 'Tavuklu, kruton, parmesan', 129.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Limonata', 'Ev yapımı, naneli', 45.00, false FROM c3;

-- Burger Atölyesi
WITH r AS (SELECT id FROM public.restaurants WHERE slug = 'burger-atolyesi'),
c1 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Burgerler', 1 FROM r RETURNING id, restaurant_id),
c2 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Yanına', 2 FROM r RETURNING id, restaurant_id),
c3 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'İçecekler', 3 FROM r RETURNING id, restaurant_id)
INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price, is_popular)
SELECT restaurant_id, id, 'Klasik Cheeseburger', '150 gr dana köfte, cheddar, turşu, özel sos', 189.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Double Smash', 'İki kat köfte, karamelize soğan, cheddar', 259.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Tavuklu Burger', 'Çıtır tavuk göğsü, ranch sos, coleslaw', 179.00, false FROM c1
UNION ALL SELECT restaurant_id, id, 'Elma Dilim Patates', 'Baharatlı, 200 gr', 69.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Soğan Halkası', '8 adet, çıtır', 75.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Milkshake', 'Çikolata, vanilya veya çilek', 89.00, true FROM c3;

-- Çiğ Köfteci Ali Usta
WITH r AS (SELECT id FROM public.restaurants WHERE slug = 'cig-kofteci-ali-usta'),
c1 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Çiğ Köfte', 1 FROM r RETURNING id, restaurant_id),
c2 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Dürümler', 2 FROM r RETURNING id, restaurant_id),
c3 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'İçecekler', 3 FROM r RETURNING id, restaurant_id)
INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price, is_popular)
SELECT restaurant_id, id, 'Çiğ Köfte Porsiyon', '500 gr, marul ve limon ile', 139.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Çiğ Köfte 1 kg', 'Kalabalık sofralar için', 249.00, false FROM c1
UNION ALL SELECT restaurant_id, id, 'Çiğ Köfte Dürüm', 'Bol nar ekşili, marul ve turp', 79.00, true FROM c2
UNION ALL SELECT restaurant_id, id, 'Acılı Dürüm', 'İsot ile ekstra acı', 85.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Şalgam', 'Bardak, acılı', 25.00, false FROM c3;

-- Anne Mutfağı
WITH r AS (SELECT id FROM public.restaurants WHERE slug = 'anne-mutfagi'),
c1 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Çorbalar', 1 FROM r RETURNING id, restaurant_id),
c2 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Ana Yemekler', 2 FROM r RETURNING id, restaurant_id),
c3 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Tatlılar', 3 FROM r RETURNING id, restaurant_id)
INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price, is_popular)
SELECT restaurant_id, id, 'Ezogelin Çorbası', 'Kırmızı mercimek, bulgur, nane', 65.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Tarhana Çorbası', 'Ev tarhanası, tereyağlı', 65.00, false FROM c1
UNION ALL SELECT restaurant_id, id, 'Karnıyarık', 'Kıymalı patlıcan, pilav ile', 175.00, true FROM c2
UNION ALL SELECT restaurant_id, id, 'Kuru Fasulye', 'Tereyağlı, pilav ve turşu ile', 149.00, true FROM c2
UNION ALL SELECT restaurant_id, id, 'Zeytinyağlı Yaprak Sarma', '8 adet, limon ile', 129.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Sütlaç', 'Fırında, tarçınlı', 69.00, false FROM c3;

-- Tatlı Kaçamak
WITH r AS (SELECT id FROM public.restaurants WHERE slug = 'tatli-kacamak'),
c1 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Şerbetli Tatlılar', 1 FROM r RETURNING id, restaurant_id),
c2 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Sütlü Tatlılar', 2 FROM r RETURNING id, restaurant_id),
c3 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Sıcak İçecekler', 3 FROM r RETURNING id, restaurant_id)
INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price, is_popular)
SELECT restaurant_id, id, 'Fıstıklı Baklava', '500 gr, Antep fıstığı', 349.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Şöbiyet', '6 adet, kaymaklı', 219.00, false FROM c1
UNION ALL SELECT restaurant_id, id, 'Künefe', 'Tel kadayıf, peynirli, sıcak servis', 149.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Kazandibi', 'Tek porsiyon', 79.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Profiterol', 'Bol çikolata soslu', 89.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Türk Kahvesi', 'Orta şekerli', 45.00, false FROM c3;

-- Balıkçı Reis
WITH r AS (SELECT id FROM public.restaurants WHERE slug = 'balikci-reis'),
c1 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Balıklar', 1 FROM r RETURNING id, restaurant_id),
c2 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Mezeler', 2 FROM r RETURNING id, restaurant_id),
c3 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'İçecekler', 3 FROM r RETURNING id, restaurant_id)
INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price, is_popular)
SELECT restaurant_id, id, 'Levrek Izgara', 'Porsiyon, roka ve limon ile', 379.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Çipura Izgara', 'Porsiyon, mevsim yeşillikleri ile', 359.00, false FROM c1
UNION ALL SELECT restaurant_id, id, 'Kalamar Tava', 'Çıtır kaplama, tartar sos', 289.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Girit Ezmesi', 'Beyaz peynir, ceviz, zeytinyağı', 99.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Deniz Börülcesi', 'Sarımsaklı, limonlu', 89.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Soda', 'Sade veya limonlu', 25.00, false FROM c3;

-- Lahmacun Evi
WITH r AS (SELECT id FROM public.restaurants WHERE slug = 'lahmacun-evi'),
c1 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Lahmacun', 1 FROM r RETURNING id, restaurant_id),
c2 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Pideler', 2 FROM r RETURNING id, restaurant_id),
c3 AS (INSERT INTO public.menu_categories (restaurant_id, name, position) SELECT id, 'Yanına', 3 FROM r RETURNING id, restaurant_id)
INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price, is_popular)
SELECT restaurant_id, id, 'Klasik Lahmacun', 'İnce hamur, 1 adet', 55.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Acılı Lahmacun', 'İsotlu, 1 adet', 59.00, true FROM c1
UNION ALL SELECT restaurant_id, id, 'Kaşarlı Pide', 'Bol kaşarlı, tereyağlı', 145.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Kıymalı Pide', 'Elde çekilmiş kıyma', 165.00, true FROM c2
UNION ALL SELECT restaurant_id, id, 'Kuşbaşılı Pide', 'Dana kuşbaşı, kaşar', 195.00, false FROM c2
UNION ALL SELECT restaurant_id, id, 'Mercimek Çorbası', 'Limonlu', 55.00, false FROM c3
UNION ALL SELECT restaurant_id, id, 'Ayran', '300 ml', 29.00, false FROM c3;