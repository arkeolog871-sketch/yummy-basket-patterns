-- Otomatik market senkronu: köprü programının kimlik doğrulaması.
--
-- Neden jeton: köprü marketin kendi bilgisayarında çalışıyor, tarayıcı
-- oturumu yok. Kullanıcı adı/parola yerine işletmeye bağlı, tek amaçlı ve
-- iptal edilebilir bir jeton veriyoruz.
--
-- Neden içeri değil dışarı bağlantı: markette sabit IP yok, kasadaki
-- bilgisayara internetten port açmak da kabul edilemez. Köprü bizim HTTPS
-- ucumuza DIŞARI doğru bağlanır; bu tablo o bağlantının kimliğidir.

create table if not exists public.restaurant_sync_tokens (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  -- Jeton bir PAROLADIR: düz metni hiç saklanmaz, yalnızca SHA-256 özeti.
  -- Veritabanı sızsa bile jetonlar kullanılamaz.
  token_hash text not null unique,
  -- Panelde "hangi jeton" ayırt edilebilsin diye ilk birkaç karakter.
  -- Tek başına işe yaramaz, tahmin için de yetmez.
  token_prefix text not null,
  -- "Bizmar kasa bilgisayarı" gibi; birden fazla şube/bilgisayar olabilir.
  label text,
  created_by uuid,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.restaurant_sync_tokens enable row level security;

-- RLS açık ve hiç politika yok: tarayıcıdan (anon/authenticated) erişilemez.
-- Yalnızca sunucu fonksiyonları (service role) okur/yazar.

create index if not exists restaurant_sync_tokens_restaurant_idx
  on public.restaurant_sync_tokens (restaurant_id, created_at desc);

-- İptal edilmemiş jetonlar için hızlı arama; doğrulama her istekte yapılıyor.
create index if not exists restaurant_sync_tokens_active_idx
  on public.restaurant_sync_tokens (token_hash)
  where revoked_at is null;
