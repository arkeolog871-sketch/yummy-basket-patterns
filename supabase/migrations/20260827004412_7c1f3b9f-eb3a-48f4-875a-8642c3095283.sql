-- Shared request rate-limit buckets for OTP/login/OAuth/order server functions.
-- Service-role only. Does not store raw IP or email.

CREATE TABLE IF NOT EXISTS public.request_rate_limit (
  bucket_key text PRIMARY KEY,
  hit_count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.consume_request_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer,
  p_now timestamptz DEFAULT now()
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.request_rate_limit%ROWTYPE;
BEGIN
  IF p_bucket_key IS NULL OR char_length(p_bucket_key) < 16 OR p_limit < 1 OR p_window_seconds < 1 THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_bucket_key, 1));

  SELECT * INTO r FROM public.request_rate_limit WHERE bucket_key = p_bucket_key FOR UPDATE;

  IF NOT FOUND OR r.reset_at <= p_now THEN
    INSERT INTO public.request_rate_limit (bucket_key, hit_count, reset_at, updated_at)
    VALUES (p_bucket_key, 1, p_now + make_interval(secs => p_window_seconds), p_now)
    ON CONFLICT (bucket_key) DO UPDATE SET
      hit_count = 1,
      reset_at = EXCLUDED.reset_at,
      updated_at = EXCLUDED.updated_at;
    RETURN true;
  END IF;

  IF r.hit_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE public.request_rate_limit
    SET hit_count = hit_count + 1, updated_at = p_now
    WHERE bucket_key = p_bucket_key;

  RETURN true;
END;
$$;

ALTER TABLE public.request_rate_limit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.request_rate_limit FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.request_rate_limit TO service_role;

REVOKE ALL ON FUNCTION public.consume_request_rate_limit(text, integer, integer, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_request_rate_limit(text, integer, integer, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_request_rate_limit(text, integer, integer, timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';
