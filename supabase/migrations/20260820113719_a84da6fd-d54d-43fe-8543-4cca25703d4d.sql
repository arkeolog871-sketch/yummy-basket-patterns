ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hero_badge text NOT NULL DEFAULT 'işletme, dakikalar içinde kapınızda',
  ADD COLUMN IF NOT EXISTS hero_title text NOT NULL DEFAULT 'Mahalleniz hazır,',
  ADD COLUMN IF NOT EXISTS hero_title_accent text NOT NULL DEFAULT 'kapınıza geliyor',
  ADD COLUMN IF NOT EXISTS hero_subtitle text NOT NULL DEFAULT 'Yemek, restoran, kafe, eğlence, market ve giyim: mahallenizdeki tüm işletmeler tek uygulamada.';