/** RPC yokken sipariş yedeğinde stok hesabı. Asıl koruma `place_customer_order` satır kilididir. */

export type StockSalePlan =
  | { ok: true; unlimited: true }
  | { ok: true; unlimited: false; next: number }
  | { ok: false; reason: "insufficient" };

export function planStockDecrement(
  current: number | null | undefined,
  quantity: number,
): StockSalePlan {
  if (quantity < 1) return { ok: false, reason: "insufficient" };
  if (current == null || !Number.isFinite(Number(current))) {
    return { ok: true, unlimited: true };
  }
  const stock = Number(current);
  if (stock < quantity) return { ok: false, reason: "insufficient" };
  return { ok: true, unlimited: false, next: stock - quantity };
}

/**
 * Vitrinde "sepete eklenebilir" mi? Sipariş RPC'si `stock_quantity < adet`
 * olan ürünü reddettiği için stoğu 0 olan ürün satılabilir değildir.
 * `planStockDecrement` ile aynı kural: sayı olmayan değer sınırsız stok sayılır.
 */
export function isSellableStock(stock: number | null | undefined): boolean {
  if (stock == null || !Number.isFinite(Number(stock))) return true;
  return Number(stock) > 0;
}
