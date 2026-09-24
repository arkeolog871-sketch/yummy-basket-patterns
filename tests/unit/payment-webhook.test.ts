import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { containsCardData, nextPaymentStatus, paymentEventSchema } from "@/lib/payment-webhook";

const route = readFileSync("src/routes/api/public/payments.webhook.ts", "utf8");

describe("ödeme bildirimi", () => {
  it("imza doğrulanmadan kayıt yazılmaz, tekrar olay işlenmez", () => {
    expect(route.indexOf("timingSafeEqual")).toBeLessThan(route.indexOf("payment_transactions"));
    expect(route).toContain('"23505"');
    expect(route).toContain("payments_not_configured");
  });
  it("kart verisi reddedilir", () => {
    expect(containsCardData('{"card_number":"x"}')).toBe(true);
    expect(containsCardData('{"note":"4111 1111 1111 1111"}')).toBe(true);
    expect(containsCardData('{"event_id":"evt_123456","amount":10}')).toBe(false);
  });
  it("bilinmeyen alan kabul edilmez", () => {
    expect(
      paymentEventSchema.safeParse({
        provider: "x1",
        event_id: "evt_123456",
        order_id: "00000000-0000-4000-8000-000000000000",
        kind: "charge",
        status: "succeeded",
        amount: 10,
        cvv: "123",
      }).success,
    ).toBe(false);
  });
  it("tutar uyuşmazsa sipariş ödendi sayılmaz", () => {
    expect(nextPaymentStatus({ kind: "charge", status: "succeeded", amount: 100 }, 100)).toBe("paid");
    expect(nextPaymentStatus({ kind: "charge", status: "succeeded", amount: 90 }, 100)).toBeNull();
    expect(nextPaymentStatus({ kind: "charge", status: "failed", amount: 100 }, 100)).toBe("failed");
    expect(nextPaymentStatus({ kind: "refund", status: "succeeded", amount: 100 }, 100)).toBe(
      "refunded",
    );
    expect(nextPaymentStatus({ kind: "partial_refund", status: "succeeded", amount: 30 }, 100)).toBeNull();
    expect(nextPaymentStatus({ kind: "refund", status: "succeeded", amount: 150 }, 100)).toBeNull();
  });
});
