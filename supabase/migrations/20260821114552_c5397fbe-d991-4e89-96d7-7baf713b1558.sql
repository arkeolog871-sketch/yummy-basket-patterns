ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS maps_api_key TEXT,
  ADD COLUMN IF NOT EXISTS maps_allowed_referrers TEXT;