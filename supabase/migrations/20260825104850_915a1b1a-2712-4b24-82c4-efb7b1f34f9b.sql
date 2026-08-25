ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS typography jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE VIEW public.public_banners AS
  SELECT a.id, a.title, a.image_url, a.action_type, a.action_value, a.display_order
  FROM public.advertisements a
  WHERE a.is_active = true AND a.start_date <= now() AND a.end_date > now()
  ORDER BY a.display_order ASC, a.created_at ASC;

ALTER VIEW public.public_banners SET (security_invoker = false);
GRANT SELECT ON public.public_banners TO anon, authenticated, service_role;