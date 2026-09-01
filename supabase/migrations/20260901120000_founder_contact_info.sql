-- Sayfa yöneticisi iletişim bilgileri (telefon / e-posta) artık site_settings üzerinden
-- kurucu panelinden düzenlenebilir. Mevcut sabit değerler varsayılan olarak korunur.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS founder_contact_phone text NOT NULL DEFAULT '0546 696 31 33',
  ADD COLUMN IF NOT EXISTS founder_contact_email text NOT NULL DEFAULT 'arkeolog871@gmail.com';

COMMENT ON COLUMN public.site_settings.founder_contact_phone IS
  'Ana sayfadaki "Sayfa yöneticisi ile iletişim" bölümünde gösterilen telefon numarası.';
COMMENT ON COLUMN public.site_settings.founder_contact_email IS
  'Ana sayfadaki "Sayfa yöneticisi ile iletişim" bölümünde gösterilen e-posta adresi.';
