-- 6 haneli e-posta OTP'sinin özeti ve son kullanma anı uygulama tarafında tutulur.
-- Düz metin kod asla yazılmaz; yalnızca SHA-256 özeti ve TTL saklanır.
ALTER TABLE public.email_otp_guard
  ADD COLUMN IF NOT EXISTS code_hash text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
