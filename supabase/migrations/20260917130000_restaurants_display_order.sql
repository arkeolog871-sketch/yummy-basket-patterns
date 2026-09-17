-- İşletme (restoran) elle sıralaması için sıra sütunu.
-- NULL = elle sıralanmadı; genel listede bu satırlar sıralananların
-- ARDINDAN puana göre dizilir (display_order NULLS LAST, sonra rating DESC).
alter table public.restaurants
  add column if not exists display_order integer;

create index if not exists restaurants_display_order_idx
  on public.restaurants (display_order)
  where display_order is not null;

-- KRİTİK: bu tablo SÜTUN BAZLI yetki kullanıyor (ör. stock_quantity anon'dan
-- çekili). Yeni bir sütun otomatik olarak anon/authenticated'a AÇILMAZ. Halka
-- açık katalog (anon) listeyi display_order'a göre sıraladığı için, bu sütunda
-- SELECT yetkisi olmadan sorgu tümden izin hatası verir ve liste BOŞ döner.
-- display_order hassas değil (yalnızca sıra numarası); okumaya açıyoruz.
grant select (display_order) on public.restaurants to anon, authenticated;
