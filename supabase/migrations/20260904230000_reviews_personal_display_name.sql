-- Yorum yazarı adı artık "Ad SS." biçiminde (ad tam, soyadın ilk 2 harfi +
-- nokta), profiles.full_name'den hesaplanıyor — "Müşteri" yalnızca hiç isim
-- kaydı olmayan (yalnızca işletme kaydıyla oluşturulmuş, kişisel girişi
-- hiç olmamış) nadir hesaplar için son çare olarak kullanılıyor.
--
-- Bu, önceki bir veri bozulmasını da düzeltiyor: işletmeci hesabı oluşturma
-- akışı (founder.server.ts) profiles.full_name'i işletme adıyla üzerine
-- yazıyordu (bkz. bu dosyadaki kod değişikliği); hem müşteri hem işletmeci
-- olan hesaplarda kişisel ad kayboluyordu. Kurtarılabilen 2 hesap Google
-- OAuth meta verisinden geri yüklendi; kurtarılamayan (yalnızca işletme
-- kaydıyla var olan) 1 hesabın adı NULL'a çekildi.
UPDATE public.profiles p
SET full_name = u.raw_user_meta_data->>'full_name'
FROM auth.users u
WHERE p.id = u.id
  AND p.full_name IN ('Aydın', 'Simpil çiftliği')
  AND u.raw_user_meta_data->>'full_name' IS NOT NULL
  AND u.raw_user_meta_data->>'full_name' <> p.full_name;

UPDATE public.profiles SET full_name = NULL WHERE id = 'ae7e71fd-a2ff-4495-baa0-1450371b7c48';

DROP FUNCTION IF EXISTS public.submit_review(uuid, smallint, text);

CREATE FUNCTION public.submit_review(
  p_restaurant_id uuid,
  p_rating smallint,
  p_comment text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_full_name text;
  v_first_word text;
  v_rest text;
  v_display_name text;
BEGIN
  SELECT full_name INTO v_full_name FROM public.profiles WHERE id = auth.uid();
  v_full_name := trim(coalesce(v_full_name, ''));

  IF v_full_name = '' THEN
    v_display_name := 'Müşteri';
  ELSE
    v_first_word := split_part(v_full_name, ' ', 1);
    v_rest := trim(substring(v_full_name from length(v_first_word) + 1));
    IF v_rest = '' THEN
      v_display_name := v_first_word;
    ELSE
      v_display_name := v_first_word || ' ' || left(v_rest, 2) || '.';
    END IF;
  END IF;

  INSERT INTO public.reviews (restaurant_id, user_id, rating, comment, author_name)
  VALUES (p_restaurant_id, auth.uid(), p_rating, p_comment, v_display_name)
  ON CONFLICT (restaurant_id, user_id) DO UPDATE
    SET rating = excluded.rating, comment = excluded.comment, author_name = excluded.author_name, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review(uuid, smallint, text) TO authenticated;

UPDATE public.reviews r SET author_name = 'Ismail Si.'
WHERE r.user_id = '4bfaec13-8725-47bb-befe-ef4aeed031b4' AND r.author_name = 'Müşteri';

NOTIFY pgrst, 'reload schema';
