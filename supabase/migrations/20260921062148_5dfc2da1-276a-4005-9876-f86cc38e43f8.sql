create or replace function public.import_menu_items_by_name(
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
      nullif(btrim(row_value ->> 'name'), '')            as name,
      lower(btrim(row_value ->> 'name'))                 as name_key,
      (row_value ->> 'price')::numeric                   as price,
      (row_value ->> 'stock')::integer                   as stock,
      (row_value ->> 'vat_rate')::numeric                as vat_rate,
      nullif(row_value ->> 'unit', '')                   as unit,
      (row_value ->> 'category_id')::uuid                as category_id,
      nullif(btrim(row_value ->> 'description'), '')     as description
    from jsonb_array_elements(p_rows) as row_value
  ),
  src as (
    select distinct on (name_key) *
      from parsed
     where name_key is not null
     order by name_key
  ),
  upd as (
    update public.menu_items m
       set price       = i.price,
           stock_quantity = coalesce(m.stock_quantity, i.stock),
           unit        = coalesce(m.unit, i.unit),
           vat_rate    = coalesce(m.vat_rate, i.vat_rate),
           category_id = coalesce(m.category_id, i.category_id),
           description = coalesce(m.description, i.description),
           source      = 'ai_menu_photo',
           synced_at   = now(),
           updated_at  = now()
      from src i
     where m.restaurant_id = p_restaurant_id
       and lower(btrim(m.name)) = i.name_key
    returning 1
  ),
  ins as (
    insert into public.menu_items (
      restaurant_id, category_id, name, description, price,
      is_popular, is_available, stock_quantity,
      unit, vat_rate, source, synced_at
    )
    select
      p_restaurant_id,
      i.category_id,
      i.name,
      i.description,
      i.price,
      false,
      true,
      coalesce(i.stock, 0),
      i.unit,
      i.vat_rate,
      'ai_menu_photo',
      now()
    from src i
    where not exists (
      select 1
        from public.menu_items m
       where m.restaurant_id = p_restaurant_id
         and lower(btrim(m.name)) = i.name_key
    )
    returning 1
  )
  select
    (select count(*)::integer from ins),
    (select count(*)::integer from upd);
end;
$$;

revoke all on function public.import_menu_items_by_name(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_menu_items_by_name(uuid, jsonb) to service_role;