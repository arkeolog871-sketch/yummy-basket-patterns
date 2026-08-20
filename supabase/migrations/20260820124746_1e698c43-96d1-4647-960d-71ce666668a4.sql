REVOKE ALL ON FUNCTION public.vendor_restaurant_id(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_vendor_of(uuid, uuid) FROM anon;