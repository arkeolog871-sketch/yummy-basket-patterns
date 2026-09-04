-- Kategori sohbet çubuğunda her kategori kendi rengiyle gösterilebilsin diye
-- sayfa yöneticisinin ayarlayabileceği isteğe bağlı bir renk alanı ekler.
ALTER TABLE public.app_categories
  ADD COLUMN IF NOT EXISTS color text;
