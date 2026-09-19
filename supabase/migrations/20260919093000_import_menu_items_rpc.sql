-- Toplu ürün aktarımının çekirdeği: 5.000 satırlık bir market listesini tek
-- çağrıda ve tek işlemde (atomik) menu_items ile birleştirir.
--
-- Neden RPC: satır satır UPDATE binlerce gidiş-dönüş demek. PostgREST'in toplu
-- upsert'i ise kısmi tekil indeksle (barcode is not null) ON CONFLICT hedefini
-- çıkaramıyor ve payload'da bulunmayan sütunları NULL'a çekme riski taşıyor —
-- description/is_popular gibi elle girilmiş alanlar silinirdi.
--
-- Neden geçici tablo YOK: `create temporary table … on commit drop` yalnızca
-- işlem sonunda düşüyor; fonksiyon aynı işlemde ikinci kez çağrıldığında
-- (dosya parça parça gönderiliyor) "relation _import_rows already exists" ile
-- patlıyordu. Bunun yerine her şey TEK deyimde, CTE zinciriyle yapılıyor:
-- ins CTE'sindeki `not exists`, deyim başındaki anlık görüntüyü okur, yani
-- upd'nin dokunduğu satırlar zaten mevcut oldukları için doğru şekilde elenir.
--
-- Birleştirme kuralı (elle yapılan düzeltmeleri korur):
--   • fiyat ve stok  -> HER aktarımda güncellenir (aktarımın amacı bu)
--   • ad ve görsel   -> yalnızca BOŞSA doldurulur; elle düzeltilmişse korunur
--   • açıklama, popülerlik, satışa açıklık -> aktarım hiç dokunmaz
create or replace function public.import_menu_items(
  p_restaurant_id uuid,
  p_rows jsonb
)
returns table (created_count integer, updated_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with parsed as (
    select
      nullif(row_value ->> 'barcode', '')     as barcode,
      nullif(row_value ->> 'external_id', '') as external_id,
      nullif(row_value ->> 'name', '')        as name,
      (row_value ->> 'price')::numeric        as price,
      (row_value ->> 'stock')::integer        as stock,
      (row_value ->> 'vat_rate')::numeric     as vat_rate,
      nullif(row_value ->> 'unit', '')        as unit,
      (row_value ->> 'category_id')::uuid     as category_id,
      nullif(row_value ->> 'image_url', '')   as image_url
    from jsonb_array_elements(p_rows) as row_value
  ),
  -- Aynı anahtarın iki kez gelmesi tekil indeksi ihlal ederdi; ilk satır kazanır.
  src as (
    select distinct on (coalesce(barcode, '#' || external_id)) *
      from parsed
     where barcode is not null or external_id is not null
     order by coalesce(barcode, '#' || external_id)
  ),
  upd as (
    update public.menu_items m
       set price          = i.price,
           stock_quantity = coalesce(i.stock, m.stock_quantity),
           unit           = coalesce(m.unit, i.unit),
           vat_rate       = coalesce(m.vat_rate, i.vat_rate),
           category_id    = coalesce(m.category_id, i.category_id),
           -- Ad ve görsel yalnızca boşken dolar: market listesindeki
           -- "COCA COLA 1LT PET" yazımı, elle düzeltilmiş adı ezmesin.
           image_url      = coalesce(m.image_url, i.image_url),
           barcode        = coalesce(m.barcode, i.barcode),
           external_id    = coalesce(m.external_id, i.external_id),
           source         = 'csv',
           synced_at      = now(),
           updated_at     = now()
      from src i
     where m.restaurant_id = p_restaurant_id
       and (
             (i.barcode is not null and m.barcode = i.barcode)
          or (i.barcode is null and i.external_id is not null and m.external_id = i.external_id)
           )
    returning 1
  ),
  ins as (
    insert into public.menu_items (
      restaurant_id, category_id, name, price, image_url,
      is_popular, is_available, stock_quantity,
      barcode, external_id, unit, vat_rate, source, synced_at
    )
    select
      p_restaurant_id,
      i.category_id,
      coalesce(i.name, 'Barkod ' || coalesce(i.barcode, i.external_id)),
      i.price,
      i.image_url,
      false,
      true,
      coalesce(i.stock, 0),
      i.barcode,
      i.external_id,
      i.unit,
      i.vat_rate,
      'csv',
      now()
    from src i
    where not exists (
      select 1
        from public.menu_items m
       where m.restaurant_id = p_restaurant_id
         and (
               (i.barcode is not null and m.barcode = i.barcode)
            or (i.barcode is null and i.external_id is not null and m.external_id = i.external_id)
             )
    )
    returning 1
  )
  select
    (select count(*)::integer from ins),
    (select count(*)::integer from upd);
end;
$$;

-- Yalnızca sunucu fonksiyonları (service role) çağırır; tarayıcıdan
-- erişilebilir olsaydı bir işletme başkasının kataloğunu yazabilirdi.
revoke all on function public.import_menu_items(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_menu_items(uuid, jsonb) to service_role;
