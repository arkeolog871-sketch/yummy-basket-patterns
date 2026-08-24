-- Global typography JSON for the founder panel.
-- Defensive: IF NOT EXISTS so older environments and re-runs stay safe.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS typography jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.site_settings.typography IS
  'Kurucu paneli global tipografi ve metin stili (CSS custom properties kaynağı).';
