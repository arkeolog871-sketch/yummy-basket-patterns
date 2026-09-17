-- İşletme (restoran) elle sıralaması için sıra sütunu.
-- NULL = elle sıralanmadı; genel listede bu satırlar sıralananların
-- ARDINDAN puana göre dizilir (display_order NULLS LAST, sonra rating DESC).
alter table public.restaurants
  add column if not exists display_order integer;

create index if not exists restaurants_display_order_idx
  on public.restaurants (display_order)
  where display_order is not null;
