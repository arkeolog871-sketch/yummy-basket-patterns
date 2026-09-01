-- Performans denetimi: yoğun kullanım altında en hızlı sorun çıkaracak iki
-- eksik indeksi kapatır (canlı veritabanına doğrudan uygulanmış, bu dosya
-- kayıt altına alıyor).

-- 1) Herkese açık işletme listesi ("Tüm restoranlar" / ana sayfa) her
--    ziyaretçide is_active=true filtresiyle rating'e göre sıralanıyor;
--    ayrıca ad/açıklama/kategori üzerinde ILIKE ile arama yapılıyor.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS restaurants_active_rating_idx
  ON public.restaurants (rating DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS restaurants_name_trgm_idx
  ON public.restaurants USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS restaurants_tagline_trgm_idx
  ON public.restaurants USING gin (tagline gin_trgm_ops);

CREATE INDEX IF NOT EXISTS restaurants_category_trgm_idx
  ON public.restaurants USING gin (category gin_trgm_ops);

-- 2) orders tablosu: işletme paneli restaurant_id'ye göre filtreleyip
--    created_at'e göre sıralıyor (~15 sn'de bir polling); kurucu paneli
--    filtresiz olarak created_at'e göre sıralıyor. İkisi de indekssizdi.
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created
  ON public.orders (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);
