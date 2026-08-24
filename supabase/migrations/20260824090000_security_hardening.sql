-- Security hardening:
-- role membership is server-managed only; authenticated clients may only read
-- their own role rows through the existing RLS policy.
DROP POLICY IF EXISTS user_roles_admin_manage ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_select_all ON public.user_roles;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;

-- Keep SECURITY DEFINER helpers non-public and prevent accidental direct calls
-- with a caller-controlled identity from becoming an authorization primitive.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_vendor_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_vendor_of(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.vendor_restaurant_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_restaurant_id(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
