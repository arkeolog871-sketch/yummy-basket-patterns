-- Market entegrasyonu 1. ve 2. aşama: barkod tabanlı toplu ürün aktarımı ve
-- işletmeler arasında paylaşılan barkod kataloğu.
--
-- Neden: bir markette 3.000-8.000 ürün var; panelden tek tek ad + fiyat +
-- görsel girmek imkânsız. Market kendi otomasyonundan (Wolvox, Mikro, Zirve…)
-- barkod + fiyat + stok listesi çıkarır; ürünün adı ve görseli ortak
-- katalogdan gelir. Katalog bir kez dolar, tüm marketler paylaşır.

-- 1) Ortak barkod kataloğu ------------------------------------------------
-- Vitrin bu tabloyu DOĞRUDAN okumaz: aktarım sırasında ad/görsel menu_items'a
-- kopyalanır. Bu yüzden anon/authenticated yetkisi verilmez; yalnızca sunucu
-- fonksiyonları (service role) erişir.
create table if not exists public.product_catalog (
  barcode text primary key,
  name text not null,
  brand text,
  image_url text,
  unit text,
  default_vat_rate numeric(5, 2),
  -- Kaydı ilk getiren işletme; katalog kalitesini denetlemek için.
  first_seen_restaurant_id uuid references public.restaurants (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_catalog enable row level security;

-- 2) menu_items'a market alanları ----------------------------------------
alter table public.menu_items
  add column if not exists barcode text,
  add column if not exists unit text,
  add column if not exists vat_rate numeric(5, 2),
  -- Marketin kendi sistemindeki stok kodu (barkodsuz ürünler için ikinci anahtar).
  add column if not exists external_id text,
  -- 'manual' | 'csv' | ileride 'api'. Elle girilen ürünün aktarımla ezilmemesi
  -- için gerekiyor.
  add column if not exists source text,
  add column if not exists synced_at timestamptz;

-- Aynı işletmede bir barkod tek ürüne karşılık gelir: CSV yüklemesi bu indeksi
-- çakışma anahtarı olarak kullanır, böylece ikinci yükleme kopya üretmez.
create unique index if not exists menu_items_restaurant_barcode_idx
  on public.menu_items (restaurant_id, barcode)
  where barcode is not null;

create unique index if not exists menu_items_restaurant_external_idx
  on public.menu_items (restaurant_id, external_id)
  where external_id is not null;

-- KRİTİK: menu_items SÜTUN BAZLI yetki kullanıyor (stock_quantity anon'dan
-- çekili). Yeni sütunlar otomatik olarak açılmaz ve vitrin sorgusu sütun
-- listesini açıkça yazsa bile, ileride bu alanları gösterecek sorgular yetki
-- hatası alıp listeyi tümden boş döndürür. Hassas olmayanları okumaya açıyoruz;
-- external_id ve source işletmenin iç bilgisi olduğu için kapalı kalıyor.
grant select (barcode, unit, vat_rate, synced_at) on public.menu_items to anon, authenticated;
grant insert (barcode, unit, vat_rate, external_id, source, synced_at)
  on public.menu_items to authenticated;
grant update (barcode, unit, vat_rate, external_id, source, synced_at)
  on public.menu_items to authenticated;

-- 3) Aktarım günlüğü ------------------------------------------------------
-- Hangi yükleme neyi değiştirdi: yanlış fiyat listesi yüklendiğinde geri
-- dönebilmek ve işletmeye "son aktarım ne zaman, kaç ürün" diyebilmek için.
create table if not exists public.product_imports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  actor_id uuid,
  source text not null default 'csv',
  file_name text,
  total_rows integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  -- Atlanan satırlar: {satir, neden, barkod} listesi. İşletme neyi düzeltmesi
  -- gerektiğini görsün diye saklanıyor.
  skipped jsonb,
  created_at timestamptz not null default now()
);

alter table public.product_imports enable row level security;

create index if not exists product_imports_restaurant_idx
  on public.product_imports (restaurant_id, created_at desc);
