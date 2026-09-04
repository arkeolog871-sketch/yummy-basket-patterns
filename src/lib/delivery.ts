import { formatPrice } from "./format";

export const DELIVERY_TYPES = [
  { slug: "kurye", label: "Kendi kuryemizle teslimat" },
  { slug: "kargo", label: "Kargo ile gönderim" },
  { slug: "gel_al", label: "Sadece gel-al (adrese teslimat yok)" },
] as const;

export type DeliveryType = (typeof DELIVERY_TYPES)[number]["slug"];

export function isDeliveryType(value: unknown): value is DeliveryType {
  return typeof value === "string" && DELIVERY_TYPES.some((item) => item.slug === value);
}

/** Restoran kartı/sayfası gibi kısa rozetlerde gösterilecek teslimat özeti. */
export function deliverySummary(
  deliveryType: string | null | undefined,
  deliveryFee: number,
): string {
  if (deliveryType === "gel_al") return "Sadece gel-al";
  if (deliveryType === "kargo") {
    return deliveryFee === 0 ? "Ücretsiz kargo" : `${formatPrice(deliveryFee)} kargo`;
  }
  return deliveryFee === 0 ? "Ücretsiz teslimat" : `${formatPrice(deliveryFee)} teslimat`;
}
