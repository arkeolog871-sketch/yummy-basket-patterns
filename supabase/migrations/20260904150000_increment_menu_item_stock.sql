-- Stok iadelerini (sipariş iptali, RPC yedek yolu) atomik bir artış olarak
-- yapmak için: eski kod "önceki mutlak değeri" geri yazıyordu, bu da
-- eşzamanlı siparişlerde zaten satılmış birimleri diriltebiliyordu.
CREATE OR REPLACE FUNCTION public.increment_menu_item_stock(p_id uuid, p_delta integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.menu_items
  SET stock_quantity = GREATEST(stock_quantity + p_delta, 0), updated_at = now()
  WHERE id = p_id;
$function$;

REVOKE ALL ON FUNCTION public.increment_menu_item_stock(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_menu_item_stock(uuid, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
