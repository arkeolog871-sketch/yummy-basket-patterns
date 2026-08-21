CREATE TABLE public.email_otp_guard (
  email_hash text PRIMARY KEY,
  last_sent_at timestamptz,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  sends_in_window integer NOT NULL DEFAULT 0,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_otp_guard TO service_role;

ALTER TABLE public.email_otp_guard ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only trusted server code (service role) may touch this table.