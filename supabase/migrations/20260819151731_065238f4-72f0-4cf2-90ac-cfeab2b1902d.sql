-- handle_new_user is a trigger-only function: nobody should call it directly.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies evaluated as the signed-in role,
-- so authenticated keeps EXECUTE; anonymous callers do not need it.
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- Plain trigger helpers do not need to be part of the exposed API surface.
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_single_default_address() FROM PUBLIC, anon, authenticated;