-- Güvenlik denetimi düzeltmesi: 20260824090000_security_hardening.sql'in
-- daralttığı yetkiler, 20260826091303 migration'ında ("client 401 alıyordu")
-- büyük ölçüde geri açılmıştı. O geri açma orders/order_items INSERT için
-- 20260901150000 ile kapatıldı, ama UPDATE ve restaurants/menu_items/
-- user_roles/vendor_assignments/founder_backup_codes tarafında açık kaldı.
-- Bu migration, kod tabanındaki her gerçek context.supabase (authenticated
-- rolü) yazma/okuma yolunu tek tek doğrulayıp yalnızca ona izin veriyor.

-- ============ orders / order_items ============
-- Tüm sipariş güncellemeleri (vendor.functions.ts, founder.functions.ts) ve
-- oluşturma (orders.functions.ts) yalnızca supabaseAdmin (service_role)
-- veya SECURITY DEFINER cancel_customer_order/place_customer_order RPC'leri
-- üzerinden yapılıyor; authenticated rolünün orders/order_items'a doğrudan
-- UPDATE ihtiyacı yok (INSERT/DELETE zaten 20260901150000 ile kapatılmıştı).
REVOKE UPDATE ON public.orders FROM authenticated;
REVOKE UPDATE ON public.order_items FROM authenticated;
DROP POLICY IF EXISTS orders_founder_update ON public.orders;
DROP POLICY IF EXISTS orders_admin_update ON public.orders;
DROP POLICY IF EXISTS orders_vendor_update ON public.orders;

-- ============ restaurants ============
-- Vendor kendi işletmesinde yalnızca mağaza durumu, minimum sipariş tutarı
-- ve logo/kapak görselini değiştirir (vendor.functions.ts, vendor-media.functions.ts);
-- founder/admin yazmaları supabaseAdmin üzerinden. contact_email işletme giriş
-- kimliği olduğu için herkese açık SELECT'ten hariç tutulur (yalnızca
-- contact_phone genel arama için gerekli).
REVOKE INSERT, UPDATE ON public.restaurants FROM authenticated;
GRANT UPDATE (is_open_manual, min_order, logo_url, cover_image_url)
  ON public.restaurants TO authenticated;

REVOKE SELECT ON public.restaurants FROM anon, authenticated;
GRANT SELECT (
  id, slug, name, tagline, category, cuisines, rating, review_count, delivery_minutes,
  delivery_fee, min_order, cover_image_url, logo_url, is_active, created_at, updated_at, sector,
  address, district, city, latitude, longitude, maps_url, opens_at, closes_at, is_open_manual,
  contact_phone
) ON public.restaurants TO anon, authenticated;

-- ============ menu_items ============
-- stock_quantity işletme içi operasyonel veri; işletme/kurucu panelleri onu
-- supabaseAdmin ile okuyor (vendor.functions.ts, founder.functions.ts), genel
-- vitrin/rakip erişimine kapalı kalmalı. Yazma yetkileri (INSERT/UPDATE/DELETE)
-- zaten restaurant sahipliğine göre RLS ile sınırlı, dokunulmuyor.
REVOKE SELECT ON public.menu_items FROM anon, authenticated;
GRANT SELECT (
  id, restaurant_id, category_id, name, description, price, image_url,
  is_popular, is_available, created_at, updated_at
) ON public.menu_items TO anon, authenticated;

-- ============ user_roles / vendor_assignments / founder_backup_codes ============
-- Bu üç tabloya her yazma (rol verme/alma, işletme ataması, yedek kod üretimi)
-- yalnızca service_role istemcisiyle, ilgili assertFounder kontrolünden sonra
-- yapılıyor; authenticated rolünün doğrudan yazma ihtiyacı yok. (profiles
-- kasıtlı olarak dışarıda bırakıldı: updateMyProfile kendi satırını
-- context.supabase ile günceller ve profiles_update_own politikasıyla
-- auth.uid() = id'ye sınırlıdır.)
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.vendor_assignments FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.founder_backup_codes FROM authenticated;

-- ============ fcm_tokens ============
-- saveFcmToken (push.functions.ts) context.supabase.upsert(..., {onConflict:"token"})
-- kullanıyor; Postgres ON CONFLICT DO UPDATE için INSERT'e ek olarak UPDATE
-- yetkisini de önceden kontrol eder, bu yüzden UPDATE grant'ı ve karşılık gelen
-- RLS politikası olmadan her çağrı "permission denied" ile başarısız oluyordu.
GRANT UPDATE ON TABLE public.fcm_tokens TO authenticated;
DROP POLICY IF EXISTS fcm_tokens_own_update ON public.fcm_tokens;
CREATE POLICY fcm_tokens_own_update ON public.fcm_tokens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
