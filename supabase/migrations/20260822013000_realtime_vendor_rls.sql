-- Canlı güncellemeler, satıcı katalog yazma yetkisi ve tek kurucu kilidi.

ALTER TABLE public.restaurants REPLICA IDENTITY FULL;
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER TABLE public.menu_categories REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER TABLE public.vendor_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.site_settings REPLICA IDENTITY FULL;
ALTER TABLE public.addresses REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'restaurants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'vendor_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_assignments;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'site_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'addresses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.addresses;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

DROP POLICY IF EXISTS menu_items_vendor_insert_own ON public.menu_items;
CREATE POLICY menu_items_vendor_insert_own ON public.menu_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_vendor_of(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS menu_items_vendor_delete_own ON public.menu_items;
CREATE POLICY menu_items_vendor_delete_own ON public.menu_items
  FOR DELETE TO authenticated
  USING (public.is_vendor_of(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS menu_categories_vendor_insert_own ON public.menu_categories;
CREATE POLICY menu_categories_vendor_insert_own ON public.menu_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_vendor_of(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS menu_categories_vendor_update_own ON public.menu_categories;
CREATE POLICY menu_categories_vendor_update_own ON public.menu_categories
  FOR UPDATE TO authenticated
  USING (public.is_vendor_of(auth.uid(), restaurant_id))
  WITH CHECK (public.is_vendor_of(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS menu_categories_vendor_delete_own ON public.menu_categories;
CREATE POLICY menu_categories_vendor_delete_own ON public.menu_categories
  FOR DELETE TO authenticated
  USING (public.is_vendor_of(auth.uid(), restaurant_id));

DO $$
BEGIN
  IF (SELECT count(*) FROM public.user_roles WHERE role = 'founder') <= 1 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_founder
      ON public.user_roles (role)
      WHERE role = 'founder';
  END IF;
END $$;
