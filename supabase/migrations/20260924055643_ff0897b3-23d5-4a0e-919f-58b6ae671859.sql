-- Yorum: teslim edilmiş sipariş varsa "doğrulanmış sipariş" bağı otomatik kurulur
CREATE OR REPLACE FUNCTION public.set_review_verified_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT o.id INTO NEW.verified_order_id
  FROM public.orders o
  WHERE o.user_id = NEW.user_id AND o.restaurant_id = NEW.restaurant_id AND o.status = 'delivered'
  ORDER BY o.created_at DESC LIMIT 1;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.set_review_verified_order() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reviews_verified_order ON public.reviews;
CREATE TRIGGER reviews_verified_order BEFORE INSERT OR UPDATE OF rating, comment ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.set_review_verified_order();

GRANT SELECT (verified_order_id, seller_reply, seller_reply_at) ON public.reviews TO anon, authenticated;

-- Tetikleyici fonksiyonunun doğrudan çağrılmasını kapat
REVOKE ALL ON FUNCTION public.refresh_restaurant_rating() FROM PUBLIC, anon, authenticated;

-- İşletme belgeleri deposu: klasör = restoran kimliği
CREATE POLICY "bizdocs vendor upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'business-documents'
  AND public.is_vendor_of(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "bizdocs read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'business-documents'
  AND (public.has_role(auth.uid(), 'founder')
       OR public.is_vendor_of(auth.uid(), ((storage.foldername(name))[1])::uuid)));
