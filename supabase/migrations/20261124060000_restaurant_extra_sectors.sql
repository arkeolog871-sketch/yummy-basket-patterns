-- Kullanıcı isteği: bir işletme (ör. dönerci) aynı anda birden fazla ana
-- kategoride görünsün — hem alt türünün kendi sektöründe (yemek) hem
-- grubunun doğal sektöründe (restoran). restaurants.sector tek değer olarak
-- kalır (birincil; renk/filtre/arama hâlâ ona göre); bu tablo yalnızca ana
-- sayfa filtresinin EK olarak eşleştirdiği sektörleri tutar.
CREATE TABLE IF NOT EXISTS public.restaurant_extra_sectors (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  sector_slug text NOT NULL CHECK (sector_slug ~ '^[a-z0-9-]+$' AND length(sector_slug) <= 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, sector_slug)
);

ALTER TABLE public.restaurant_extra_sectors ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (ana sayfa filtresi girişsiz de çalışıyor); yazma yalnız
-- servis rolüyle (saveBusiness / reviewBusinessApplication sunucu kodu).
DROP POLICY IF EXISTS restaurant_extra_sectors_public_read ON public.restaurant_extra_sectors;
CREATE POLICY restaurant_extra_sectors_public_read
  ON public.restaurant_extra_sectors
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON public.restaurant_extra_sectors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.restaurant_extra_sectors TO anon, authenticated;
GRANT ALL ON public.restaurant_extra_sectors TO service_role;

CREATE INDEX IF NOT EXISTS restaurant_extra_sectors_sector_idx
  ON public.restaurant_extra_sectors (sector_slug);

-- Geriye dönük doldurma: zaten kayıtlı işletmelerin alt türüne göre grubun
-- doğal sektörü, mevcut birincil sektörden farklıysa ve geçerli bir ana
-- kategoriyse ekleniyor (src/lib/business-category-catalog.ts'teki
-- resolveExtraCatalogSectors ile aynı mantık).
WITH group_defaults(group_name, default_sector) AS (
  VALUES
    ('Yeme-İçme', 'restoran'),
    ('Fırın, Pastane ve Tatlı', 'kafe'),
    ('Market ve Gıda', 'market'),
    ('Giyim ve Moda', 'giyim'),
    ('Ayakkabı, Çanta ve Takı', 'giyim'),
    ('Güzellik ve Kişisel Bakım', 'kisisel-bakim'),
    ('Sağlık', 'saglik'),
    ('Eczane ve Medikal', 'eczane-ve-medikal'),
    ('Otomotiv', 'otomotiv'),
    ('Teknik Servis ve Onarım', 'teknik-servis-ve-onarim'),
    ('Bilişim ve Elektronik', 'bilisim-ve-teknoloji'),
    ('Usta ve Yapı Hizmetleri', 'tesisat'),
    ('Yapı Malzemesi ve Hırdavat', 'yapi-malzemesi-ve-hirdavat'),
    ('Mobilya ve Ev Eşyası', 'mobilya-ve-ev-esyasi'),
    ('Temizlik', 'temizlik'),
    ('Nakliye ve Taşımacılık', 'nakliye'),
    ('Ulaşım ve Seyahat', 'ulasim-ve-seyahat'),
    ('Konaklama', 'konaklama'),
    ('Eğitim', 'egitim'),
    ('Eğlence ve Etkinlik', 'eglence'),
    ('Düğün ve Özel Gün', 'eglence'),
    ('Fotoğraf ve Video', 'fotograf-ve-video'),
    ('Spor ve Hobi', 'spor-ve-hobi'),
    ('Evcil Hayvan ve Hayvancılık', 'hayvancilik'),
    ('Tarım ve Bahçe', 'tarim-ve-bahce'),
    ('Kırtasiye, Kitap ve Hediye', 'kirtasiye-kitap-ve-hediye'),
    ('Mesleki Hizmetler', 'mesleki-hizmetler'),
    ('Emlak, Finans ve Sigorta', 'emlak-finans-ve-sigorta'),
    ('Enerji ve Yakıt', 'enerji-ve-yakit')
)
INSERT INTO public.restaurant_extra_sectors (restaurant_id, sector_slug)
SELECT DISTINCT r.id, gd.default_sector
FROM public.restaurants r
JOIN public.business_category_catalog bcc ON bcc.name = r.category
JOIN group_defaults gd ON gd.group_name = bcc.group_name
JOIN public.app_categories ac ON ac.slug = gd.default_sector
WHERE gd.default_sector IS DISTINCT FROM bcc.sector_slug
ON CONFLICT DO NOTHING;
