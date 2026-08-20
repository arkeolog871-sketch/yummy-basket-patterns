const TR_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i̇: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[çğıöşüâîû]/g, (char) => TR_MAP[char] ?? char)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

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

/** Canlı takip çubuğu adımları: birden fazla durum aynı adıma düşebilir. */
export const ORDER_TRACK_STEPS = [
  { label: "Sipariş Alındı", statuses: ["pending", "confirmed"] },
  { label: "Hazırlanıyor", statuses: ["preparing"] },
  { label: "Yolda", statuses: ["on_the_way"] },
  { label: "Teslim Edildi", statuses: ["delivered"] },
] as const;

export function orderStepIndex(status: string): number {
  const index = ORDER_TRACK_STEPS.findIndex((step) =>
    (step.statuses as readonly string[]).includes(status),
  );
  return index;
}