-- Eşleştirme kodları hiçbir zaman vitrinden okunmamalı: sütun bazlı yetkiyi
-- açıkça geri alıyoruz (mevcut durumda da verilmemişti, bu bir güvence katmanı).
REVOKE SELECT (pairing_code) ON public.restaurants FROM anon, authenticated;
REVOKE SELECT (pairing_code_expires_at) ON public.restaurants FROM anon, authenticated;