-- Close the empty-row FOR UPDATE gap on first OTP issue and make consume a
-- single compare-and-swap UPDATE so two parallel verifications cannot both match.
-- Service-role only; does not rewrite application data.

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

CREATE OR REPLACE FUNCTION public.consume_email_otp(
  p_email_hash text,
  p_code_hash text,
  p_now timestamptz DEFAULT now()
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.email_otp_guard%ROWTYPE;
  v_updated integer;
BEGIN
  IF p_email_hash IS NULL OR p_code_hash IS NULL THEN
    RETURN 'mismatch';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_email_hash, 0));

  UPDATE public.email_otp_guard
  SET code_hash = NULL,
      expires_at = NULL,
      failed_attempts = 0,
      locked_until = NULL,
      updated_at = p_now
  WHERE email_hash = p_email_hash
    AND code_hash IS NOT DISTINCT FROM p_code_hash
    AND (
      (expires_at IS NOT NULL AND expires_at >= p_now)
      OR (
        expires_at IS NULL
        AND last_sent_at IS NOT NULL
        AND last_sent_at >= p_now - interval '10 minutes'
      )
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    RETURN 'match';
  END IF;

  SELECT * INTO r FROM public.email_otp_guard WHERE email_hash = p_email_hash;
  IF NOT FOUND OR r.code_hash IS NULL THEN
    RETURN 'missing';
  END IF;
  IF (r.expires_at IS NOT NULL AND r.expires_at < p_now)
     OR (r.expires_at IS NULL AND r.last_sent_at IS NOT NULL AND r.last_sent_at < p_now - interval '10 minutes') THEN
    RETURN 'expired';
  END IF;
  RETURN 'mismatch';
END;
$$;

CREATE OR REPLACE FUNCTION public.register_email_otp_failure(
  p_email_hash text,
  p_now timestamptz DEFAULT now()
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.email_otp_guard%ROWTYPE;
  v_attempts integer;
BEGIN
  IF p_email_hash IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_email_hash, 0));

  SELECT * INTO r FROM public.email_otp_guard WHERE email_hash = p_email_hash FOR UPDATE;
  v_attempts := COALESCE(r.failed_attempts, 0) + 1;

  IF NOT FOUND THEN
    INSERT INTO public.email_otp_guard (
      email_hash, window_started_at, sends_in_window, failed_attempts, updated_at
    ) VALUES (
      p_email_hash, p_now, 0, v_attempts, p_now
    )
    ON CONFLICT (email_hash) DO UPDATE SET
      failed_attempts = public.email_otp_guard.failed_attempts + 1,
      updated_at = p_now
    RETURNING failed_attempts INTO v_attempts;
    RETURN v_attempts;
  END IF;

  UPDATE public.email_otp_guard
  SET failed_attempts = v_attempts,
      locked_until = CASE WHEN v_attempts >= 5 THEN p_now + interval '15 minutes' ELSE locked_until END,
      code_hash = CASE WHEN v_attempts >= 5 THEN NULL ELSE code_hash END,
      expires_at = CASE WHEN v_attempts >= 5 THEN NULL ELSE expires_at END,
      updated_at = p_now
  WHERE email_hash = p_email_hash;

  RETURN v_attempts;
END;
$$;
