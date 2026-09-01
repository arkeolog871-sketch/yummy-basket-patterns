-- Alt bilgi (footer) metinleri artık sabit kod değeri değil; kurucu panelinden
-- ("Ana sayfa" sekmesi) düzenlenebilir. Mevcut sabit değerler varsayılan olarak korunur.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS footer_tagline text NOT NULL
    DEFAULT 'Mahallenin en iyi ustalarından sıcak yemekler, kapınıza kadar.',
  ADD COLUMN IF NOT EXISTS footer_delivery_hours text NOT NULL
    DEFAULT 'Her gün 10:00 – 23:30';

COMMENT ON COLUMN public.site_settings.footer_tagline IS
  'Alt bilgide marka adının altında gösterilen kısa tanıtım cümlesi.';
COMMENT ON COLUMN public.site_settings.footer_delivery_hours IS
  'Alt bilgide "Teslimat saatleri" başlığı altında gösterilen metin.';
