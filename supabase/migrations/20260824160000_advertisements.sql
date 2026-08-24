-- Silvan Cebimde advertisements (kayan reklam / banner).
-- PostgreSQL production schema. MySQL eşdeğeri: ENUM yerine VARCHAR + CHECK,
-- timestamptz yerine DATETIME(6), uuid yerine CHAR(36).
-- IF NOT EXISTS / OR REPLACE: tekrar çalıştırmak güvenli.

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

DROP POLICY IF EXISTS advertisements_founder_all ON public.advertisements;
CREATE POLICY advertisements_founder_all ON public.advertisements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

DROP TRIGGER IF EXISTS advertisements_set_updated_at ON public.advertisements;
CREATE TRIGGER advertisements_set_updated_at
  BEFORE UPDATE ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

NOTIFY pgrst, 'reload schema';
