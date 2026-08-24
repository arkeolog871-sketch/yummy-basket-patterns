-- Kayan reklam / hero banner slaytları (Kurucu Paneli).
-- IF NOT EXISTS: tekrar çalıştırmak güvenli; token gerekmez.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hero_banners jsonb NOT NULL DEFAULT '{"autoplay":true,"intervalMs":5000,"slides":[]}'::jsonb;

COMMENT ON COLUMN public.site_settings.hero_banners IS
  'Kurucu paneli kayan reklam / hero banner slaytları.';

NOTIFY pgrst, 'reload schema';
