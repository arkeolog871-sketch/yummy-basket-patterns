-- Yorum yapabilmek için "bu işletmeden teslim edilmiş sipariş" şartı
-- kaldırılıyor; artık herhangi bir giriş yapmış kullanıcı bir işletmeye
-- (işletme başına tek yorum kuralı korunarak) yorum bırakabilir.
DROP POLICY IF EXISTS reviews_insert_verified_customer ON public.reviews;

CREATE POLICY reviews_insert_own ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
