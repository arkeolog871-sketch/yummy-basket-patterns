-- Security hardening:
-- role membership is server-managed only; authenticated clients may only read
-- their own role rows through the existing RLS policy.
DROP POLICY IF EXISTS user_roles_admin_manage ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_select_all ON public.user_roles;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;

-- Orders are created and changed only after server-side price, stock, status,
-- and ownership checks. Direct PostgREST writes would permit forged totals or
-- "paid" orders, so keep the existing read policies but remove write grants.
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated;
REVOKE SELECT ON public.founder_backup_codes FROM authenticated;

-- Vendors only need these storefront controls. Founder catalog writes use the
-- service-role client after an explicit founder check.
REVOKE UPDATE ON public.restaurants FROM authenticated;
GRANT UPDATE (is_open_manual, logo_url, cover_image_url) ON public.restaurants TO authenticated;

-- Inventory is operational data, not public catalog data. Vendor/admin server
-- handlers use the service-role client for their authenticated dashboard reads.
REVOKE SELECT ON public.menu_items FROM anon;
REVOKE SELECT ON public.menu_items FROM authenticated;
GRANT SELECT (
  id, restaurant_id, category_id, name, description, price, image_url,
  is_popular, is_available, created_at, updated_at
) ON public.menu_items TO anon, authenticated;

-- Keep SECURITY DEFINER helpers non-public and prevent accidental direct calls
-- with a caller-controlled identity from becoming an authorization primitive.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_vendor_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_vendor_of(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.vendor_restaurant_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_restaurant_id(uuid) TO service_role;

-- This must exist unconditionally so two concurrent bootstrap requests cannot
-- create two founder accounts.
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_founder
  ON public.user_roles (role)
  WHERE role = 'founder';

NOTIFY pgrst, 'reload schema';
