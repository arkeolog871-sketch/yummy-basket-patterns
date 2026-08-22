-- maps_allowed_referrers was added to an earlier migration after that
-- migration had already been applied, so production PostgREST never saw it.
-- Saving Google Maps settings then failed with:
-- "Could not find the 'maps_allowed_referrers' column of 'site_settings' in the schema cache"
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS maps_api_key TEXT,
  ADD COLUMN IF NOT EXISTS maps_allowed_referrers TEXT;

NOTIFY pgrst, 'reload schema';
