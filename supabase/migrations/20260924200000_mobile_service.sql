-- İş yeri olmayan (müşterinin adresine giderek hizmet veren) işletmeler:
-- tesisatçı, kaynakçı, nakliyeci gibi. Başvuruda "İş yerim yok" seçilince
-- harita konumu ve açık adres istenmez; müşteri tarafında konum yerine
-- "Adrese gelir" yazar ve yol tarifi gösterilmez.
--
-- Mevcut kayıtlar değişmez: varsayılan false (iş yeri var).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS mobile_service boolean NOT NULL DEFAULT false;

ALTER TABLE public.business_applications
  ADD COLUMN IF NOT EXISTS mobile_service boolean NOT NULL DEFAULT false;

-- Gezici başvuruda adres ve koordinat boş kalabilir...
ALTER TABLE public.business_applications
  ALTER COLUMN address DROP NOT NULL,
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

-- ...ama iş yeri olan başvuruda eskisi gibi zorunlu (sunucu doğrulamasına
-- ek olarak veritabanı da denetler).
ALTER TABLE public.business_applications
  DROP CONSTRAINT IF EXISTS business_applications_location_required;
ALTER TABLE public.business_applications
  ADD CONSTRAINT business_applications_location_required
  CHECK (mobile_service OR (address IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL));

-- restaurants sütun bazlı okunuyor: yeni sütun vitrine açık olmalı, yoksa
-- işletme listesi sorgusu "permission denied" ile düşer.
GRANT SELECT (mobile_service) ON public.restaurants TO anon, authenticated;
