-- Ana kategoriler artık her alt türü tek, doğru bir ana kategoriye bağlıyor
-- (bkz. 20261124100000_business_category_catalog_v2.sql) — bir işletmenin
-- aynı anda birden fazla ana kategoride görünmesine artık gerek yok
-- (ör. dönerci hem Yemek hem Restoran'da görünsün diye eklenmişti; Restoran
-- artık Yemek'in kendisi). Bu tabloyu kullanan kod da kaldırıldı.
DROP TABLE IF EXISTS public.restaurant_extra_sectors;
