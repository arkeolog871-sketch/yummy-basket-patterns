-- İşletme detayındaki Ara butonu için ziyaretçiler contact_phone okuyabilsin.
-- contact_email hâlâ kolon GRANT dışında (giriş bilgisi).
REVOKE SELECT ON public.restaurants FROM anon, authenticated;
GRANT SELECT (
  id, slug, name, tagline, category, cuisines, rating, review_count, delivery_minutes,
  delivery_fee, min_order, cover_image_url, logo_url, is_active, created_at, updated_at, sector,
  address, district, city, latitude, longitude, maps_url, opens_at, closes_at, is_open_manual,
  contact_phone
) ON public.restaurants TO anon, authenticated;
GRANT ALL ON public.restaurants TO service_role;
