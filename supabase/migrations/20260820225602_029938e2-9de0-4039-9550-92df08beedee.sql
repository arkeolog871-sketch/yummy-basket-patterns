-- 1) Restaurant contact details: no longer readable by visitors or ordinary signed-in users
REVOKE SELECT ON public.restaurants FROM anon, authenticated;
GRANT SELECT (
  id, slug, name, tagline, category, cuisines, rating, review_count, delivery_minutes,
  delivery_fee, min_order, cover_image_url, is_active, created_at, updated_at, sector,
  address, district, city, latitude, longitude, maps_url, opens_at, closes_at, is_open_manual
) ON public.restaurants TO anon, authenticated;
GRANT ALL ON public.restaurants TO service_role;

-- 2) Harden SECURITY DEFINER helpers so signed-in users cannot probe other users
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM _user_id THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_vendor_of(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM _user_id THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.vendor_assignments
    WHERE user_id = _user_id AND restaurant_id = _restaurant_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_vendor_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vendor_restaurant_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_vendor_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_restaurant_id(uuid) TO service_role;

-- 3) Explicit authorization rules for the private branding files
DROP POLICY IF EXISTS "branding_founder_admin_read" ON storage.objects;
DROP POLICY IF EXISTS "branding_founder_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "branding_founder_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "branding_founder_admin_delete" ON storage.objects;

CREATE POLICY "branding_founder_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'branding'
    AND (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "branding_founder_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "branding_founder_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'branding'
    AND (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    bucket_id = 'branding'
    AND (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "branding_founder_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'branding'
    AND (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
  );