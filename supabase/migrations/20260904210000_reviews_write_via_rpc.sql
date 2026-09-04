-- `context.supabase.from("reviews").upsert(...)` üzerinden PostgREST'e giden
-- INSERT ... ON CONFLICT DO UPDATE isteği, yetkiler/RLS/auth.uid() tamamen
-- doğru olsa bile canlıda tutarlı biçimde "permission denied for table
-- reviews" ile başarısız oluyordu (pg_stat_statements'ta bu sorgunun hiç
-- görünmemesi, PostgREST'in isteği Postgres'e ulaştırmadan reddettiğini
-- gösteriyor). Aynı INSERT ... ON CONFLICT bir SECURITY INVOKER RPC
-- içinden .rpc() ile çağrılınca sorunsuz çalıştığı canlıda doğrulandı; bu
-- yüzden yazma işlemleri (submit/delete) RPC üzerinden yapılıyor.
--
-- Bu migration ayrıca tanı için eklenmiş geçici fonksiyonları
-- (debug_whoami, debug_try_insert) temizliyor.

DROP FUNCTION IF EXISTS public.debug_whoami();
DROP FUNCTION IF EXISTS public.debug_try_insert(uuid, uuid);

CREATE OR REPLACE FUNCTION public.submit_review(
  p_restaurant_id uuid,
  p_rating smallint,
  p_comment text,
  p_author_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  INSERT INTO public.reviews (restaurant_id, user_id, rating, comment, author_name)
  VALUES (p_restaurant_id, auth.uid(), p_rating, p_comment, p_author_name)
  ON CONFLICT (restaurant_id, user_id) DO UPDATE
    SET rating = excluded.rating, comment = excluded.comment, author_name = excluded.author_name, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review(uuid, smallint, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_review(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM public.reviews WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_review(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
