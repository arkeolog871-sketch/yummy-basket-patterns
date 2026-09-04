-- Müşteri yorum ve değerlendirme (review) sistemi. restaurants.rating /
-- review_count şimdiye kadar yalnızca demo verisiyle doldurulmuş statik
-- sütunlardı (hiçbir yazma yolu yoktu); bu migration gerçek müşteri
-- yorumlarını saklayan bir tablo ekleyip bu iki sütunu otomatik olarak
-- güncel tutuyor.

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  -- Yorum anındaki görünen isim; profiles satırına join gerektirmez (profiles
  -- yalnızca kendi satırını okuma RLS'i taşıyor) ve kullanıcı adını
  -- değiştirse bile geçmiş yorum aynı kalır.
  author_name text NOT NULL DEFAULT 'Müşteri',
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id)
);

CREATE INDEX reviews_restaurant_idx ON public.reviews (restaurant_id, created_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Bu projede public şemadaki yeni tablolara varsayılan olarak anon/
-- authenticated için tam CRUD veriliyor (ALTER DEFAULT PRIVILEGES); aşağıdaki
-- dar GRANT'lardan önce bunları iptal etmek gerekiyor, yoksa dar GRANT'lar
-- var olan geniş yetkinin üzerine eklenip hiçbir şeyi kısıtlamaz.
REVOKE ALL ON public.reviews FROM anon, authenticated;

GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT (restaurant_id, user_id, rating, comment, author_name) ON public.reviews TO authenticated;
GRANT UPDATE (rating, comment, author_name, updated_at) ON public.reviews TO authenticated;
GRANT DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

CREATE POLICY reviews_public_read ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (is_hidden = false);

CREATE POLICY reviews_founder_read_all ON public.reviews
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

-- Sahte yorumları önlemek için: yalnızca o işletmeden teslim edilmiş en az
-- bir siparişi olan kullanıcı yorum bırakabilir (bir işletme başına tek yorum,
-- tekrar gönderim upsert ile düzenleme sayılır).
CREATE POLICY reviews_insert_verified_customer ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = auth.uid()
        AND o.restaurant_id = reviews.restaurant_id
        AND o.status = 'delivered'
    )
  );

CREATE POLICY reviews_update_own ON public.reviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY reviews_delete_own ON public.reviews
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER reviews_set_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- restaurants.rating / review_count'u her yorum ekleme/düzenleme/silme/
-- gizleme sonrası otomatik yeniden hesaplar. SECURITY DEFINER: yorum yazan
-- authenticated kullanıcının restaurants tablosunda rating/review_count
-- için ayrı bir GRANT'a ihtiyacı olmadan (ve olmaması gerekirken) bu alanları
-- güncelleyebilmesi için.
CREATE OR REPLACE FUNCTION public.refresh_restaurant_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid := COALESCE(NEW.restaurant_id, OLD.restaurant_id);
BEGIN
  UPDATE public.restaurants
  SET
    rating = COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews
        WHERE restaurant_id = target_id AND is_hidden = false),
      0
    ),
    review_count = (
      SELECT COUNT(*) FROM public.reviews
      WHERE restaurant_id = target_id AND is_hidden = false
    )
  WHERE id = target_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER reviews_refresh_restaurant_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_restaurant_rating();

NOTIFY pgrst, 'reload schema';
