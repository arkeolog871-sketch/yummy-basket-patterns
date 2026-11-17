ALTER TABLE public.vendor_assignments ADD COLUMN IF NOT EXISTS is_selected boolean NOT NULL DEFAULT false;
UPDATE public.vendor_assignments SET is_selected = true WHERE is_selected = false;
ALTER TABLE public.vendor_assignments DROP CONSTRAINT IF EXISTS vendor_assignments_user_id_key;
ALTER TABLE public.vendor_assignments ADD CONSTRAINT vendor_assignments_user_restaurant_key UNIQUE (user_id, restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_assignments_one_selected_idx ON public.vendor_assignments (user_id) WHERE is_selected;

CREATE OR REPLACE FUNCTION public.vendor_restaurant_id(_user_id uuid)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT restaurant_id FROM public.vendor_assignments WHERE user_id = _user_id
  ORDER BY is_selected DESC, created_at ASC LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_restaurant_pairing_code(p_user_id uuid, p_code text)
 RETURNS TABLE(restaurant_id uuid, restaurant_name text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_name text;
begin
  select r.id, r.name into v_id, v_name
    from public.restaurants r
   where r.pairing_code is not null
     and upper(r.pairing_code) = upper(btrim(p_code))
     and (r.pairing_code_expires_at is null or r.pairing_code_expires_at > now())
   limit 1;
  if v_id is null then
    return;
  end if;
  update public.vendor_assignments set is_selected = false where user_id = p_user_id and is_selected;
  insert into public.vendor_assignments (user_id, restaurant_id, is_selected)
  values (p_user_id, v_id, true)
  on conflict (user_id, restaurant_id) do update set is_selected = true;
  insert into public.user_roles (user_id, role)
  values (p_user_id, 'vendor')
  on conflict (user_id, role) do nothing;
  return query select v_id, v_name;
end;
$function$;