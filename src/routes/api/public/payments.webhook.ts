import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { containsCardData, nextPaymentStatus, paymentEventSchema } from "@/lib/payment-webhook";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * Ödeme kuruluşu bildirimi. İmza (HMAC-SHA256, x-payment-signature)
 * doğrulanmadan hiçbir kayıt yazılmaz; aynı olay ikinci kez işlenmez.
 */
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYMENT_WEBHOOK_SECRET"];
        if (!secret) return json(503, { error: "payments_not_configured" });
        const raw = await request.text();
        if (raw.length > 20_000) return json(413, { error: "too_large" });
        const sig = Buffer.from(request.headers.get("x-payment-signature") ?? "");
        const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
        if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
          return json(401, { error: "invalid_signature" });
        }
        if (containsCardData(raw)) return json(422, { error: "card_data_rejected" });
        let parsed;
        try {
          parsed = paymentEventSchema.safeParse(JSON.parse(raw));
        } catch {
          return json(400, { error: "invalid_json" });
        }
        if (!parsed.success) return json(400, { error: "invalid_event" });
        const event = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, total")
          .eq("id", event.order_id)
          .maybeSingle();
        if (!order) return json(404, { error: "order_not_found" });

        const { error } = await supabaseAdmin.from("payment_transactions").insert({
          order_id: event.order_id,
          provider: event.provider,
          provider_transaction_id: event.provider_transaction_id ?? null,
          kind: event.kind,
          amount: event.amount,
          status: event.status,
          idempotency_key: `${event.provider}:${event.event_id}`,
          raw_event_hash: createHash("sha256").update(raw).digest("hex"),
        });
        if (error?.code === "23505") return json(200, { ok: true, duplicate: true });
        if (error) return json(500, { error: "store_failed" });

        const next = nextPaymentStatus(event, Number(order.total));
        if (next) {
          await supabaseAdmin
            .from("orders")
            .update({ payment_status: next })
            .eq("id", event.order_id);
        } else if (event.status === "succeeded") {
          const { logAudit } = await import("@/lib/audit.server");
          await logAudit({
            actorId: null,
            action: "payment.amount_mismatch",
            entity: "orders",
            entityId: event.order_id,
            detail: { amount: event.amount, total: Number(order.total), kind: event.kind },
          });
          return json(409, { error: "amount_mismatch" });
        }
        return json(200, { ok: true });
      },
    },
  },
});
