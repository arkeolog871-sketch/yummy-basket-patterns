-- Bir hesap silme talebi onaylandığında auth.users satırı silinir; orders.user_id
-- FK'si ON DELETE CASCADE olduğu için bu, müşterinin TÜM sipariş/order_items
-- geçmişini de (teslim edilmiş/ödenmiş kayıtlar dahil) geri dönüşsüz siliyordu.
-- Muhasebe ve işletme kayıtları için siparişler saklanmalı; yalnızca kişisel
-- veriler (ad, telefon, adres) anonimleştirilmeli. FK'yi SET NULL'a çeviriyoruz.
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.orders DROP CONSTRAINT orders_user_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
