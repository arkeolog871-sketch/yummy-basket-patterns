-- Data API erişim izinleri (grants) hiç verilmemiş: istemci tarafı tüm okuma/yazma 401 dönüyordu.
-- Herkese açık okunabilen içerik
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT SELECT ON public.app_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_categories TO authenticated;
GRANT SELECT ON public.service_areas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_areas TO authenticated;
GRANT SELECT ON public.restaurants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT SELECT ON public.menu_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT SELECT ON public.business_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_media TO authenticated;

-- Yalnızca oturum açmış kullanıcı / yetkili erişimi
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertisements TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.app_errors TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.founder_backup_codes TO authenticated;

-- Sunucu tarafı (service_role) tüm tablolar
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- maps_config ve email_otp_guard yalnızca sunucu tarafında kalır (anon/authenticated izni yok).
