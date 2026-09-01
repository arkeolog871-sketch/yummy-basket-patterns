-- Yetki (GRANT) sıkılaştırması — savunma derinliği.
--
-- Bulgu: Supabase'in varsayılan sağlayıcı davranışı her tabloda anon/authenticated
-- rollerine SELECT/INSERT/UPDATE/DELETE/TRUNCATE veriyor ve güvenliği tamamen RLS
-- politikalarına bırakıyor. Bu, tek katmanlı bir savunma: bir RLS politikası yanlışlıkla
-- silinir/gevşetilirse veya RLS kapatılırsa, altındaki GRANT'lar hâlâ izin veriyor olur.
--
-- Somut ve istismar edilebilir sonucu: orders/order_items tablolarında authenticated
-- rolü için "kendi siparişini ekle" politikası (auth.uid() = user_id) hem RLS hem GRANT
-- seviyesinde açıktı. Bu, kimliği doğrulanmış herhangi bir müşterinin, sunucu tarafındaki
-- fiyat/stok/minimum sipariş/işletme-açık kontrollerini (place_customer_order RPC'sinin
-- yaptığı) tamamen atlayarak Supabase istemcisiyle DOĞRUDAN, keyfi tutarlı bir sipariş
-- satırı ekleyebilmesi anlamına geliyordu.
--
-- Sipariş oluşturma zaten yalnızca SECURITY DEFINER place_customer_order RPC'si veya
-- server-only service-role istemcisi (src/lib/orders.functions.ts) üzerinden yapılıyor;
-- authenticated rolünün orders/order_items'a doğrudan INSERT/DELETE erişimine hiçbir
-- zaman ihtiyacı olmadı. Bu değişiklik canlı veritabanına doğrudan uygulanmış, bu dosya
-- yalnızca kayıt altına alıyor ve gelecekteki (sıfırdan kurulan) ortamlarda da aynı
-- sıkılaştırmanın uygulanmasını sağlıyor.

-- 1) Sahte sipariş açığını kapat.
DROP POLICY IF EXISTS orders_insert_own ON public.orders;
DROP POLICY IF EXISTS order_items_insert_own ON public.order_items;

REVOKE INSERT, DELETE, TRUNCATE ON public.orders FROM anon, authenticated;
REVOKE INSERT, DELETE, TRUNCATE ON public.order_items FROM anon, authenticated;
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;

-- 2) anon (oturumsuz) rolü hiçbir tabloda yazma yetkisine sahip olmasın; yalnızca
--    gerçekten herkese açık kataloğu SELECT edebilsin. Bu 7 tablo dışında anon'un
--    hiçbir tabloda RLS politikası zaten yok (bkz. pg_policies), yani bu değişiklik
--    davranışı bozmaz, yalnızca RLS'siz kalınan bir senaryodaki riski kapatır.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
  END LOOP;
END $$;

GRANT SELECT ON public.menu_categories TO anon;
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT ON public.app_categories TO anon;
GRANT SELECT ON public.service_areas TO anon;
GRANT SELECT ON public.business_media TO anon;
GRANT SELECT ON public.restaurants TO anon;

-- 3) TRUNCATE, RLS tarafından süzülmez ve hiçbir uygulama akışında meşru değildir;
--    authenticated rolünden de kaldırılır (anon zaten adım 2'de sıfırlandı).
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE TRUNCATE ON TABLE public.%I FROM authenticated', t);
  END LOOP;
END $$;
