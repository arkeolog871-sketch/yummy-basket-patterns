export function formatPrice(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Onay bekliyor",
  confirmed: "Onaylandı",
  preparing: "Hazırlanıyor",
  on_the_way: "Yolda",
  delivered: "Teslim edildi",
  cancelled: "İptal edildi",
};

export const ORDER_STATUS_FLOW = [
  "pending",
  "confirmed",
  "preparing",
  "on_the_way",
  "delivered",
] as const;