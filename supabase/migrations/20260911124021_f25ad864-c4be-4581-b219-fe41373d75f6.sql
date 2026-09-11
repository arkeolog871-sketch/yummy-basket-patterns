CREATE TABLE public.page_manager_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  city text NOT NULL,
  district text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, city, district)
);

CREATE INDEX page_manager_roles_active_idx ON public.page_manager_roles (user_id) WHERE is_active;

GRANT SELECT ON public.page_manager_roles TO authenticated;
GRANT ALL ON public.page_manager_roles TO service_role;

ALTER TABLE public.page_manager_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_manager_roles_select_own" ON public.page_manager_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "page_manager_roles_founder_select" ON public.page_manager_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'founder'));

CREATE TRIGGER page_manager_roles_set_updated_at
  BEFORE UPDATE ON public.page_manager_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_page_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.page_manager_roles
    WHERE user_id = _user_id AND is_active
  )
$$;

CREATE OR REPLACE FUNCTION public.manages_region(_user_id uuid, _city text, _district text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.page_manager_roles
    WHERE user_id = _user_id
      AND is_active
      AND lower(btrim(city)) = lower(btrim(coalesce(_city, '')))
      AND lower(btrim(district)) = lower(btrim(coalesce(_district, '')))
  )
$$;

REVOKE ALL ON FUNCTION public.is_page_manager(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manages_region(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_page_manager(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manages_region(uuid, text, text) TO authenticated, service_role;