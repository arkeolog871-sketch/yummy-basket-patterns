-- İşletme artık teslimat şeklini ("kurye" / "kargo" / "gel_al") kendi
-- panelinden seçer. Önceden yalnızca delivery_fee = 0 olup olmamasına göre
-- "Ücretsiz teslimat" / "X teslimat" ayrımı vardı; bu, farklı sektörlerdeki
-- işletmelerin (market, giyim, çiftlik ürünleri vb.) gerçek teslimat
-- yöntemini yansıtmıyordu — kimi kargoyla gönderiyor, kimi yalnızca
-- mağazadan teslim (gel-al) veriyor.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'kurye';

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_delivery_type_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_delivery_type_check
  CHECK (delivery_type IN ('kurye', 'kargo', 'gel_al'));

-- Vendor kendi teslimat şeklini ve ücretini belirleyebilsin (bkz.
-- vendor.functions.ts: setVendorDelivery) — min_order ile aynı desende;
-- satır düzeyinde restaurants_vendor_update_own politikası zaten yalnızca
-- kendi işletmesine izin veriyor.
GRANT UPDATE (delivery_type, delivery_fee) ON public.restaurants TO authenticated;

-- Müşteri tarafı (restoran kartı, restoran sayfası, sepet) teslimat şeklini
-- gösterebilsin.
GRANT SELECT (delivery_type) ON public.restaurants TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
