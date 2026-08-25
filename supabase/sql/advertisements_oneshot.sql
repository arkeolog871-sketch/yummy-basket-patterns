-- TEK SEFER. SQL Editor: hiçbir satırı seçmeden Run.
-- Kova hatası tabloyu geri almasın diye storage/view exception ile yutulur.
-- Sonda sonuç satırı: advertisements | true | true
-- Proje: wxkyhwkcuiqxxxpawcid

DO $$ BEGIN
  CREATE TYPE public.advertisement_action_type AS ENUM ('phone', 'internal_route', 'external_link');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  action_type public.advertisement_action_type NOT NULL DEFAULT 'internal_route',
  action_value text NOT NULL DEFAULT '/',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  impression_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advertisements_title_len CHECK (char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT advertisements_dates CHECK (end_date > start_date),
  CONSTRAINT advertisements_order_nonneg CHECK (display_order >= 0),
  CONSTRAINT advertisements_counts_nonneg CHECK (impression_count >= 0 AND click_count >= 0)
);

CREATE INDEX IF NOT EXISTS advertisements_public_feed_idx
  ON public.advertisements (display_order ASC, created_at ASC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS advertisements_schedule_idx
  ON public.advertisements (is_active, start_date, end_date);

COMMENT ON TABLE public.advertisements IS 'Kurucu paneli kayan reklam / banner kayıtları.';

ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.advertisements FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.advertisements TO authenticated;
GRANT ALL ON TABLE public.advertisements TO service_role;
GRANT USAGE ON TYPE public.advertisement_action_type TO anon, authenticated, service_role;

DROP POLICY IF EXISTS advertisements_founder_all ON public.advertisements;
DO $$ BEGIN
  CREATE POLICY advertisements_founder_all ON public.advertisements
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'founder'))
    WITH CHECK (public.has_role(auth.uid(), 'founder'));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'advertisements policy: %', SQLERRM;
END $$;

DROP TRIGGER IF EXISTS advertisements_set_updated_at ON public.advertisements;
DO $$ BEGIN
  CREATE TRIGGER advertisements_set_updated_at
    BEFORE UPDATE ON public.advertisements
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION
  WHEN undefined_function THEN
    CREATE OR REPLACE FUNCTION public.advertisements_touch_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
    AS $fn$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $fn$;
    CREATE TRIGGER advertisements_set_updated_at
      BEFORE UPDATE ON public.advertisements
      FOR EACH ROW EXECUTE FUNCTION public.advertisements_touch_updated_at();
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.advertisements_enforce_schedule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.end_date <= now() THEN
    NEW.is_active := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS advertisements_enforce_schedule ON public.advertisements;
CREATE TRIGGER advertisements_enforce_schedule
  BEFORE INSERT OR UPDATE ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.advertisements_enforce_schedule();

CREATE OR REPLACE FUNCTION public.expire_stale_advertisements()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.advertisements
    SET is_active = false
    WHERE is_active = true
      AND end_date < now()
    RETURNING id
  )
  SELECT count(*)::integer FROM updated;
$$;

CREATE OR REPLACE FUNCTION public.get_active_banners()
RETURNS TABLE (
  id uuid,
  title text,
  image_url text,
  action_type public.advertisement_action_type,
  action_value text,
  display_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.title,
    a.image_url,
    a.action_type,
    a.action_value,
    a.display_order
  FROM public.advertisements a
  WHERE a.is_active = true
    AND a.start_date <= now()
    AND a.end_date > now()
  ORDER BY a.display_order ASC, a.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.track_advertisement(p_id uuid, p_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_type = 'impression' THEN
    UPDATE public.advertisements
    SET impression_count = impression_count + 1
    WHERE id = p_id
      AND is_active = true
      AND start_date <= now()
      AND end_date > now();
  ELSIF p_type = 'click' THEN
    UPDATE public.advertisements
    SET click_count = click_count + 1
    WHERE id = p_id
      AND is_active = true
      AND start_date <= now()
      AND end_date > now();
  ELSE
    RAISE EXCEPTION 'invalid track type';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_advertisements() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_banners() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_advertisement(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_advertisements() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_active_banners() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.track_advertisement(uuid, text) TO anon, authenticated, service_role;

DO $view$
BEGIN
  EXECUTE $v$
    CREATE OR REPLACE VIEW public.public_banners AS
    SELECT
      a.id,
      a.title,
      a.image_url,
      a.action_type,
      a.action_value,
      a.display_order
    FROM public.advertisements a
    WHERE a.is_active = true
      AND a.start_date <= now()
      AND a.end_date > now()
    ORDER BY a.display_order ASC, a.created_at ASC
  $v$;
  BEGIN
    EXECUTE 'ALTER VIEW public.public_banners SET (security_invoker = false)';
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
  EXECUTE 'GRANT SELECT ON public.public_banners TO anon, authenticated, service_role';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'public_banners: %', SQLERRM;
END;
$view$;

DO $storage$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('banners', 'banners', true, 31457280, NULL)
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = GREATEST(COALESCE(storage.buckets.file_size_limit, 0), 31457280),
    allowed_mime_types = NULL;

  EXECUTE 'DROP POLICY IF EXISTS "banners_public_read" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "banners_founder_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "banners_founder_update" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "banners_founder_delete" ON storage.objects';

  EXECUTE $p$
    CREATE POLICY "banners_public_read" ON storage.objects
      FOR SELECT
      USING (bucket_id = 'banners')
  $p$;
  EXECUTE $p$
    CREATE POLICY "banners_founder_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'banners' AND public.has_role(auth.uid(), 'founder'))
  $p$;
  EXECUTE $p$
    CREATE POLICY "banners_founder_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'founder'))
      WITH CHECK (bucket_id = 'banners' AND public.has_role(auth.uid(), 'founder'))
  $p$;
  EXECUTE $p$
    CREATE POLICY "banners_founder_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'founder'))
  $p$;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'banners kovası: %', SQLERRM;
END;
$storage$;

NOTIFY pgrst, 'reload schema';

SELECT
  to_regclass('public.advertisements')::text AS advertisements_table,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_active_banners'
  ) AS get_active_banners,
  EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'banners'
  ) AS banners_bucket;
