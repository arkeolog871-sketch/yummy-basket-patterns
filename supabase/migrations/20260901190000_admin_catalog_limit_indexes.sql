-- Performans denetimi madde 3 (düşük riskli kısmı): kurucu paneli
-- listAdminData sınırsız restaurants/menu_categories/menu_items sorguları
-- çekiyordu. Gerçek sayfalama arayüz tarafında büyük bir değişiklik
-- gerektirdiğinden şimdilik uygulanmadı; bunun yerine kod tarafına cömert
-- bir LIMIT eklendi (bkz. src/lib/founder.functions.ts) ve isme göre
-- sıralamayı destekleyen indeksler eklendi.

CREATE INDEX IF NOT EXISTS restaurants_name_idx ON public.restaurants (name);
CREATE INDEX IF NOT EXISTS menu_items_name_idx ON public.menu_items (name);
