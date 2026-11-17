REVOKE INSERT, UPDATE ON public.profiles FROM authenticated, anon;
GRANT INSERT (id, full_name, phone) ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, updated_at) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_phone_verified_on_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW.phone_verified := false;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_reset_phone_verified ON public.profiles;
CREATE TRIGGER profiles_reset_phone_verified BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.reset_phone_verified_on_change();