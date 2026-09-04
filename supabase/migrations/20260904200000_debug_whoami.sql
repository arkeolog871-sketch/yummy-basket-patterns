-- Geçici tanı fonksiyonu: gerçek istek Postgres'e ulaştığında hangi rol/JWT
-- ile çalıştığını görmek için (reviews yazma izninin neden hâlâ reddedildiğini
-- anlamak amacıyla). authenticated'e EXECUTE veriliyor; kalıcı bir yetki
-- genişletmesi değil, yalnızca current_user/current_setting okuyor.
CREATE OR REPLACE FUNCTION public.debug_whoami()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'current_user', current_user,
    'session_user', session_user,
    'auth_uid', auth.uid()::text,
    'jwt_claims', current_setting('request.jwt.claims', true),
    'jwt_claim_role', current_setting('request.jwt.claim.role', true)
  );
$$;

GRANT EXECUTE ON FUNCTION public.debug_whoami() TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
