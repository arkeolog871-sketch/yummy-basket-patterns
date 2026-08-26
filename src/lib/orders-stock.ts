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
