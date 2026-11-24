-- Düzeltme: 20261124060000_restaurant_extra_sectors.sql grubun kendi
-- varsayılan sektörünü ("Yeme-İçme" → restoran) otomatik ekliyordu; bu
-- yüzden dönerci, büfe gibi "yemek" alt türleri yanlışlıkla "Restoran"
-- filtresine de giriyordu (kullanıcı geri bildirimi: "Bunlar restoran değil
-- ki, sen bunları niye restoranta ekledin?").
--
-- Doğrusu: ek sektör ilişkisi elle, tek tek seçilir
-- (src/lib/business-category-catalog.ts'teki satır başı extraSectors alanı),
-- gruba göre türetilmez. "Restoran" (ve aynı grubun diğer tam-menü
-- lokantaları) kendi kategorisinde kalır, AYRICA "Yemek" filtresinde de
-- görünür; "Dönerci" gibi zaten "yemek" olan alt türler "Restoran"a sızmaz.
-- "Büfe ve tostçu" hem "Market" hem "Yemek" filtresinde görünür (tost da
-- satılır). "Kadın kuaförü" ve "Berber" "Kişisel bakım"da da görünür.
--
-- Önceki (yanlış) satırları temizleyip doğrusunu yazıyoruz.
DELETE FROM public.restaurant_extra_sectors;

WITH extra_map(category_name, extra_sector) AS (
  VALUES
    ('Restoran', 'yemek'),
    ('Kebapçı', 'yemek'),
    ('Balık restoranı', 'yemek'),
    ('Tandır ve kuzu çevirme', 'yemek'),
    ('Et restoranı', 'yemek'),
    ('Meyhane', 'yemek'),
    ('Yöresel mutfak', 'yemek'),
    ('Uzak Doğu mutfağı', 'yemek'),
    ('Dünya mutfağı', 'yemek'),
    ('Büfe ve tostçu', 'market'),
    ('Kadın kuaförü', 'kisisel-bakim'),
    ('Berber', 'kisisel-bakim')
)
INSERT INTO public.restaurant_extra_sectors (restaurant_id, sector_slug)
SELECT DISTINCT r.id, em.extra_sector
FROM public.restaurants r
JOIN extra_map em ON em.category_name = r.category
JOIN public.app_categories ac ON ac.slug = em.extra_sector
WHERE em.extra_sector IS DISTINCT FROM r.sector
ON CONFLICT DO NOTHING;
