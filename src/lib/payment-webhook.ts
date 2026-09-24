import { z } from "zod";

/**
 * Sağlayıcıdan bağımsız ödeme olayı. Lisanslı ödeme/e-para kuruluşu
 * seçildiğinde, onun bildirimi bu biçime çevrilir. Kart numarası, CVV,
 * son kullanma tarihi gibi kart verisi hiçbir zaman kabul edilmez.
 */
export const paymentEventSchema = z
  .object({
    provider: z.string().trim().min(2).max(40),
    event_id: z.string().trim().min(6).max(120),
    order_id: z.string().uuid(),
    kind: z.enum(["charge", "refund", "partial_refund"]),
    status: z.enum(["succeeded", "failed", "pending"]),
    amount: z.number().positive().max(1_000_000),
    provider_transaction_id: z.string().trim().max(120).nullable().optional(),
  })
  .strict();
export type PaymentEvent = z.infer<typeof paymentEventSchema>;

const CARD_KEYS = /(^|_)(pan|card_?number|cvv|cvc|expiry|exp_month|exp_year)$/i;

/** Gövdede kart verisine benzeyen alan ya da 13–19 haneli sayı dizisi var mı? */
export function containsCardData(raw: string): boolean {
  try {
    const walk = (v: unknown): boolean => {
      if (v && typeof v === "object")
        return Object.entries(v as Record<string, unknown>).some(
          ([k, val]) => CARD_KEYS.test(k) || walk(val),
        );
      return typeof v === "string" && /\b\d{13,19}\b/.test(v.replace(/[\s-]/g, ""));
    };
    return walk(JSON.parse(raw));
  } catch {
    return false;
  }
}

/** Başarılı olayın siparişin ödeme durumuna etkisi; tutar uyuşmazsa null. */
export function nextPaymentStatus(
  event: Pick<PaymentEvent, "kind" | "status" | "amount">,
  orderTotal: number,
): "paid" | "failed" | "refunded" | null {
  const same = Math.abs(event.amount - orderTotal) < 0.005;
  if (event.kind === "charge") {
    if (event.status === "failed") return "failed";
    if (event.status === "succeeded") return same ? "paid" : null;
    return null;
  }
  if (event.status !== "succeeded") return null;
  if (event.amount - orderTotal > 0.005) return null;
  return event.kind === "refund" && same ? "refunded" : null;
}
