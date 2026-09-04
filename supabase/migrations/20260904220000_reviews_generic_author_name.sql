-- Yorum yazarı adı her zaman "Müşteri" olacak; kimlik göstermiyor. Önceden
-- profiles.full_name kullanılıyordu, ama bu alan işletmeci hesaplarında
-- (vendor paneli için) işletme adıyla dolduruluyor — bir işletme sahibi
-- başka bir işletmeye yorum yaptığında yorumun kendi işletme adıyla
-- görünmesine yol açıyordu. submit_review artık yazar adını parametre
-- olarak almıyor, sabit "Müşteri" değerini kullanıyor.
DROP FUNCTION IF EXISTS public.submit_review(uuid, smallint, text, text);

CREATE FUNCTION public.submit_review(
  p_restaurant_id uuid,
  p_rating smallint,
  p_comment text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  INSERT INTO public.reviews (restaurant_id, user_id, rating, comment, author_name)
  VALUES (p_restaurant_id, auth.uid(), p_rating, p_comment, 'Müşteri')
  ON CONFLICT (restaurant_id, user_id) DO UPDATE
    SET rating = excluded.rating, comment = excluded.comment, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review(uuid, smallint, text) TO authenticated;

UPDATE public.reviews SET author_name = 'Müşteri' WHERE author_name <> 'Müşteri';

NOTIFY pgrst, 'reload schema';
