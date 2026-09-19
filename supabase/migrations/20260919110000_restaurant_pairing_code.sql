-- İşletme hesabı eşleştirme kodu.
--
-- Sorun: işletmeye bildirim gönderebilmek için `vendor_assignments` satırı
-- gerekiyor ve bu satır, işletme başvurusundaki e-postayla açılan hesaba
-- bağlanıyor. Ama işletme sahibi uygulamayı indirip **Apple ile** giriş
-- yaptığında Apple gerçek e-postayı vermiyor; `xxxx@privaterelay.appleid.com`
-- biçiminde yeni bir kimlik veriyor ve Supabase bunu AYRI bir kullanıcı olarak
-- açıyor. Sahip uygulamayı kullanıyor, bildirim izni veriyor, cihazı kayıtlı
-- oluyor — ama o cihaz hiçbir işletmeye bağlı olmadığı için siparişte kimseye
-- bildirim gitmiyor. Google'da da sahip, başvuruda yazandan farklı bir hesapla
-- girerse aynı şey oluyor.
--
-- Çözüm: işletmeye özel kısa bir kod. Sahip hangi sağlayıcıyla girerse girsin,
-- uygulamada "İşletme hesabımı bağla" deyip kodu yazınca O ANKİ hesabı
-- işletmeye bağlanıyor. E-posta eşleşmesine hiç gerek kalmıyor.
alter table public.restaurants
  add column if not exists pairing_code text,
  add column if not exists pairing_code_expires_at timestamptz;

create unique index if not exists restaurants_pairing_code_idx
  on public.restaurants (pairing_code)
  where pairing_code is not null;

-- KRİTİK: restaurants tablosu sütun bazlı yetki kullanıyor. Koda SELECT
-- yetkisi VERİLMİYOR — kod bir paroladır; vitrinden okunabilseydi herkes
-- istediği işletmenin paneline bağlanabilirdi. Kodu yalnızca sunucu
-- fonksiyonları (service role) okur ve yalnızca kurucu/bölge yöneticisine
-- gösterir.

/**
 * Kodu kullanarak çağıran kullanıcıyı işletmeye bağlar.
 *
 * SECURITY DEFINER: çağıran sıradan bir kullanıcı ve ne restaurants'ı ne de
 * vendor_assignments'ı kendi yetkisiyle yazabilir. Kod doğruysa bağlama
 * işlemini fonksiyon üstleniyor.
 *
 * Dönen değer: bağlanan işletmenin adı, kod geçersizse null.
 */
create or replace function public.redeem_restaurant_pairing_code(
  p_user_id uuid,
  p_code text
)
returns table (restaurant_id uuid, restaurant_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  select r.id, r.name into v_id, v_name
    from public.restaurants r
   where r.pairing_code is not null
     and upper(r.pairing_code) = upper(btrim(p_code))
     and (r.pairing_code_expires_at is null or r.pairing_code_expires_at > now())
   limit 1;

  if v_id is null then
    return;
  end if;

  -- Bir kullanıcı tek işletmeye bağlıdır (vendor_assignments.user_id tekil);
  -- yeniden bağlanma eskisini değiştirir.
  insert into public.vendor_assignments (user_id, restaurant_id)
  values (p_user_id, v_id)
  on conflict (user_id) do update set restaurant_id = excluded.restaurant_id;

  insert into public.user_roles (user_id, role)
  values (p_user_id, 'vendor')
  on conflict (user_id, role) do nothing;

  return query select v_id, v_name;
end;
$$;

revoke all on function public.redeem_restaurant_pairing_code(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_restaurant_pairing_code(uuid, text) to service_role;
