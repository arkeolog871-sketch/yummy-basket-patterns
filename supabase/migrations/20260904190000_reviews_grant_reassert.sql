-- Bir gerçek kullanıcı yorum göndermeyi denediğinde "permission denied for
-- table reviews" hatası alındı. Canlıda information_schema.column_privileges
-- kontrol edildiğinde authenticated rolünün reviews üzerindeki INSERT/UPDATE
-- yetkisi kaybolmuştu — 20260904170000 migration'ında doğru şekilde
-- kurulmuş ve o an doğrulanmış olmasına rağmen. Kök sebep kesin olarak
-- belirlenemedi (bu projede daha önce de bir kez varsayılan yetkilerin
-- sessizce geri geldiği görülmüştü, bkz. 20260826091303 → 20260901150000 →
-- 20260904140000 migration zinciri); bu migration yalnızca doğru yetki
-- durumunu yeniden ve kalıcı şekilde beyan ediyor.
REVOKE ALL ON public.reviews FROM anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT (restaurant_id, user_id, rating, comment, author_name) ON public.reviews TO authenticated;
GRANT UPDATE (rating, comment, author_name, updated_at) ON public.reviews TO authenticated;
GRANT DELETE ON public.reviews TO authenticated;

NOTIFY pgrst, 'reload schema';
