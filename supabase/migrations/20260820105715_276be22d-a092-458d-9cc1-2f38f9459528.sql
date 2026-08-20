ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT 'yemek';

UPDATE public.restaurants
  SET sector = CASE
    WHEN category IN ('Tatlı', 'Pastane', 'Kahve', 'Kahvaltı') THEN 'kafe'
    WHEN category IN ('Deniz Ürünleri', 'İtalyan', 'Pizza', 'Burger') THEN 'restoran'
    ELSE 'yemek'
  END;

CREATE INDEX IF NOT EXISTS restaurants_sector_idx ON public.restaurants (sector);