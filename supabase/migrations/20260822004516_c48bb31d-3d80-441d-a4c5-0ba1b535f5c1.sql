DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='site_settings' AND column_name <> 'maps_api_key';

  EXECUTE 'REVOKE SELECT ON public.site_settings FROM anon';
  EXECUTE 'REVOKE SELECT ON public.site_settings FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.site_settings TO anon', cols);
  EXECUTE format('GRANT SELECT (%s) ON public.site_settings TO authenticated', cols);
END $$;