-- Performans denetimi madde 4: request_rate_limit ve email_otp_guard
-- tablolarında hiç temizlik mekanizması yoktu; süresi dolmuş satırlar
-- kalıcı olarak birikiyordu. Fırsatçı (opportunistic) temizlik ekler:
-- her çağrının ~%1'inde, o çağrının kendi sonucunu etkilemeden, günü
-- geçmiş satırları siler. Fonksiyon imzaları ve dönüş davranışları
-- değişmiyor — sadece ek, isteğe bağlı bir DELETE adımı eklendi.

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

  IF random() < 0.01 THEN
    DELETE FROM public.request_rate_limit WHERE reset_at < p_now - interval '1 day';
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

CREATE OR REPLACE FUNCTION public.issue_email_otp(
  p_email_hash text,
  p_code_hash text,
  p_now timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.email_otp_guard%ROWTYPE;
  v_sends integer;
  v_window_start timestamptz;
  v_wait integer;
BEGIN
  IF p_email_hash IS NULL OR char_length(p_email_hash) < 32 OR p_code_hash IS NULL OR char_length(p_code_hash) < 32 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  IF random() < 0.01 THEN
    DELETE FROM public.email_otp_guard
    WHERE updated_at < p_now - interval '1 day'
      AND (locked_until IS NULL OR locked_until < p_now);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_email_hash, 0));

  SELECT * INTO r FROM public.email_otp_guard WHERE email_hash = p_email_hash FOR UPDATE;

  IF FOUND AND r.last_sent_at IS NOT NULL THEN
    v_wait := 60 - FLOOR(EXTRACT(EPOCH FROM (p_now - r.last_sent_at)))::integer;
    IF v_wait > 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'cooldown', 'retry_after', v_wait);
    END IF;
  END IF;

  IF NOT FOUND OR EXTRACT(EPOCH FROM (p_now - r.window_started_at)) >= 3600 THEN
    v_window_start := p_now;
    v_sends := 0;
  ELSE
    v_window_start := r.window_started_at;
    v_sends := r.sends_in_window;
  END IF;

  IF v_sends >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'hourly');
  END IF;

  INSERT INTO public.email_otp_guard (
    email_hash, last_sent_at, window_started_at, sends_in_window,
    failed_attempts, locked_until, code_hash, expires_at, updated_at
  ) VALUES (
    p_email_hash, p_now, v_window_start, v_sends + 1,
    0, NULL, p_code_hash, p_now + interval '10 minutes', p_now
  )
  ON CONFLICT (email_hash) DO UPDATE SET
    last_sent_at = EXCLUDED.last_sent_at,
    window_started_at = EXCLUDED.window_started_at,
    sends_in_window = EXCLUDED.sends_in_window,
    failed_attempts = 0,
    locked_until = NULL,
    code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('ok', true);
END;
$$;
