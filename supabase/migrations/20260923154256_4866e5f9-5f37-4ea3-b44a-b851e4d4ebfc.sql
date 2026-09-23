-- Sipariş iptali: yalnız giriş yapmış kullanıcı (sunucu fonksiyonu context.supabase ile çağırır).
REVOKE EXECUTE ON FUNCTION public.cancel_customer_order(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_customer_order(uuid, uuid) TO authenticated;

-- Yalnız servis anahtarıyla çağrılan yardımcılar.
REVOKE EXECUTE ON FUNCTION public.increment_menu_item_stock(uuid, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_page_manager(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manages_region(uuid, text, text) FROM anon, authenticated;

-- Tetikleyici fonksiyonu; doğrudan çağrılmasına gerek yok.
REVOKE EXECUTE ON FUNCTION public.refresh_restaurant_rating() FROM anon, authenticated;

-- Arama yolu sabitlenmesi.
ALTER FUNCTION public.delete_my_review(uuid) SET search_path = public;