-- OTP doğrulamasında verilen yasal onay (Kullanım Koşulları, Gizlilik, KVKK).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
