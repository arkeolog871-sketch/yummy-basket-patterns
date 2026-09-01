-- Kurucu, ana sayfa/rozet/logo işareti arka planlarında kullanılan "warm"
-- (sıcak/kahve tonu) rengi değiştiremiyordu — bu renk styles.css içinde
-- --warm/--gradient-warm/--gradient-hero olarak sabitti, site_settings'e
-- hiç bağlı değildi. Diğer tema renkleri (primary/accent/secondary/
-- background) gibi düzenlenebilir olması için yeni sütun eklendi.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS warm_color text NOT NULL DEFAULT '#f3dfc0';
