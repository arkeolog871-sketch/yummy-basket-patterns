CREATE OR REPLACE FUNCTION public.enforce_restaurant_publish_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Belge/doğrulama yayın kapısı şimdilik askıda: yayına alma yalnız yönetici onayına bağlı.
  RETURN NEW;
END; $function$;