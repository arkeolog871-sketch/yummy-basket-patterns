CREATE TABLE IF NOT EXISTS public.maps_config (
  id text PRIMARY KEY DEFAULT 'global',
  api_key text,
  allowed_referrers text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.maps_config TO service_role;

ALTER TABLE public.maps_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS maps_config_service_only ON public.maps_config;
CREATE POLICY maps_config_service_only ON public.maps_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'maps_api_key'
  ) THEN
    INSERT INTO public.maps_config (id, api_key, allowed_referrers)
    SELECT 'global', maps_api_key, maps_allowed_referrers
    FROM public.site_settings WHERE id = 'global'
    ON CONFLICT (id) DO UPDATE
      SET api_key = EXCLUDED.api_key, allowed_referrers = EXCLUDED.allowed_referrers;
  ELSE
    INSERT INTO public.maps_config (id)
    VALUES ('global')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.site_settings DROP COLUMN IF EXISTS maps_api_key;
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS maps_allowed_referrers;

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='site_settings';
  EXECUTE format('GRANT SELECT (%s) ON public.site_settings TO anon', cols);
  EXECUTE format('GRANT SELECT (%s) ON public.site_settings TO authenticated', cols);
END $$;
