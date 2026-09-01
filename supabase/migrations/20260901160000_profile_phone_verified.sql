-- Müşteri profili: telefon numarasının doğrulanmış olup olmadığını izlemek için
-- hazırlık sütunu. Gerçek SMS doğrulaması bir SMS sağlayıcısı (Twilio/GatewayAPI)
-- bağlandıktan sonra eklenecek; o zamana kadar bu alan false kalır ve zorunlu
-- tutulmaz. E-posta doğrulaması zaten auth.users.email_confirmed_at üzerinden
-- (assertVerifiedEmail) sipariş oluşturmada zorunludur.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.phone_verified IS
  'Telefon numarası SMS ile doğrulandı mı. SMS sağlayıcısı bağlanana kadar her zaman false.';
