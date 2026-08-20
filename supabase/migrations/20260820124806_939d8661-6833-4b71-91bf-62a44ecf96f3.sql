REVOKE ALL ON FUNCTION public.vendor_restaurant_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_vendor_of(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_vendor_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_restaurant_id(uuid) TO service_role;