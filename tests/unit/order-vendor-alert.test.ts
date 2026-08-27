import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render } from "@react-email/render";
import { getRequest } from "@tanstack/react-start/server";
import { NewOrderEmail } from "@/lib/email-templates/new-order";
import {
  __orderVendorAlertTest,
  finishPlacedOrder,
} from "@/lib/order-vendor-alert.server";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: vi.fn(() => {
    throw new Error("No StartEvent found in AsyncLocalStorage");
  }),
}));

const ROOT = join(import.meta.dirname, "../..");

describe("vendor new-order alerts", () => {
  it("notifies only after placeOrder succeeds and keeps ok:true if notify setup fails", () => {
    const text = readFileSync(join(ROOT, "src/lib/orders.functions.ts"), "utf8");
    expect(text).toMatch(/finishPlacedOrder/);
    expect(text).toMatch(/order-vendor-alert\.server/);
    const placedAt = text.indexOf("placeOrder(");
    const notifyAt = text.indexOf("finishPlacedOrder");
    const isolatedReturn = text.indexOf("return { ok: true as const, ...placed }");
    expect(placedAt).toBeGreaterThan(0);
    expect(notifyAt).toBeGreaterThan(placedAt);
    expect(isolatedReturn).toBeGreaterThan(notifyAt);
    expect(text).toMatch(/withOrderIdempotencyLock/);
    expect(text).toMatch(/bildirim başlatılamadı/);
  });

  it("returns ok:true before vendor notify finishes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const notify = vi.fn().mockImplementation(() => gate);
    const result = await finishPlacedOrder({ id: "order-fast", total: 220 }, notify);
    expect(result).toEqual({ ok: true, id: "order-fast", total: 220 });
    expect(notify).toHaveBeenCalledWith("order-fast");
    release();
    await gate;
  });

  it("keeps the isolate alive with request.waitUntil when the runtime provides it", async () => {
    const waitUntil = vi.fn();
    vi.mocked(getRequest).mockReturnValueOnce({ waitUntil } as never);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const notify = vi.fn().mockImplementation(() => gate);
    const result = await finishPlacedOrder({ id: "order-wait", total: 90 }, notify);
    expect(result).toEqual({ ok: true, id: "order-wait", total: 90 });
    expect(notify).toHaveBeenCalledWith("order-wait");
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0]?.[0]).toBeInstanceOf(Promise);
    release();
    await gate;
  });

  it("returns ok:true when order is placed and vendor notify succeeds", async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    await expect(finishPlacedOrder({ id: "order-ok", total: 220 }, notify)).resolves.toEqual({
      ok: true,
      id: "order-ok",
      total: 220,
    });
    expect(notify).toHaveBeenCalledWith("order-ok");
  });

  it("returns ok:true when order is placed but email notify throws", async () => {
    const notify = vi.fn().mockRejectedValue(new Error("e-posta gönderilemedi"));
    await expect(finishPlacedOrder({ id: "order-mail", total: 80 }, notify)).resolves.toEqual({
      ok: true,
      id: "order-mail",
      total: 80,
    });
    expect(notify).toHaveBeenCalledWith("order-mail");
  });

  it("returns ok:true when order is placed but in-app notify throws", async () => {
    const notify = vi.fn().mockRejectedValue(new Error("in-app bildirim başarısız"));
    await expect(finishPlacedOrder({ id: "order-app", total: 50 }, notify)).resolves.toEqual({
      ok: true,
      id: "order-app",
      total: 50,
    });
    expect(notify).toHaveBeenCalledWith("order-app");
  });

  it("does not claim a second in_app or email alert for the same order", () => {
    const { decideClaimAfterInsert } = __orderVendorAlertTest;
    expect(decideClaimAfterInsert({ insertError: null, markSent: true })).toBe("already_sent");
    expect(
      decideClaimAfterInsert({ insertError: { code: "23505" }, markSent: true }),
    ).toBe("check_existing");
    expect(
      decideClaimAfterInsert({
        insertError: { code: "23505" },
        markSent: true,
        existingSentAt: "2026-08-26T00:00:00.000Z",
      }),
    ).toBe("already_sent");
    expect(
      decideClaimAfterInsert({
        insertError: { code: "23505" },
        markSent: false,
        existingSentAt: "2026-08-26T00:00:00.000Z",
      }),
    ).toBe("already_sent");
    expect(
      decideClaimAfterInsert({
        insertError: { code: "23505" },
        markSent: false,
        existingSentAt: null,
      }),
    ).toBe("claimed");
  });


  it("loads restaurant email and order rows from the database, not the client payload", () => {
    const text = readFileSync(join(ROOT, "src/lib/order-vendor-alert.server.ts"), "utf8");
    expect(text).toMatch(/from\("orders"\)/);
    expect(text).toMatch(/from\("restaurants"\)/);
    expect(text).toMatch(/contact_email/);
    expect(text).not.toMatch(/data\.contact_email/);
    expect(text).not.toMatch(/data\.recipient_name/);
    expect(text).toMatch(/vendor-new-order-/);
    expect(text).toMatch(/23505/);
  });

  it("reuses Lovable email sending, not a second provider", () => {
    const text = readFileSync(join(ROOT, "src/lib/order-vendor-alert.server.ts"), "utf8");
    expect(text).toMatch(/sendLovableEmail/);
    expect(text).toMatch(/LOVABLE_API_KEY/);
    expect(text).toMatch(/waitUntil/);
    expect(text).toMatch(/continueAfterResponse/);
    expect(text).not.toMatch(/await notify\(/);
    expect(text).not.toMatch(/setTimeout\(|process\.nextTick|queueMicrotask\(/);
    expect(text).toMatch(/deliverInAppAlert/);
    expect(text).toMatch(/deliverOrderEmail/);
    expect(text).toMatch(/UNIQUE \(order_id, channel\)|channel: "in_app"|channel: "email"/);
    expect(text).toMatch(/in-app bildirim başarısız/);
    expect(text).toMatch(/e-posta bildirimi başarısız/);
    expect(text).not.toMatch(/resend|nodemailer|sendgrid|postmark/i);
  });

  it("renders order details in the vendor email template", async () => {
    const html = await render(
      React.createElement(NewOrderEmail, {
        siteName: "SİLVAN CEBİMDE",
        restaurantName: "Simpil Kebap",
        dashboardUrl: "https://uygulamamcebimde.online/vendor/dashboard",
        createdAtLabel: "26 Ağu 2026 12:00",
        recipientName: "Ada Yılmaz",
        phone: "05320000000",
        address: "Atatürk Cad. 1, Merkez / Silvan",
        note: "Kapıyı çalmayın",
        lines: [
          {
            name: "Adana",
            quantity: 2,
            unitPriceLabel: "₺100,00",
            lineTotalLabel: "₺200,00",
          },
        ],
        subtotalLabel: "₺200,00",
        deliveryFeeLabel: "₺20,00",
        totalLabel: "₺220,00",
        paymentLabel: "Kapıda ödeme",
      }),
    );
    expect(html).toMatch(/Yeni sipariş/);
    expect(html).toContain("Simpil Kebap");
    expect(html).toContain("Ada Yılmaz");
    expect(html).toMatch(/2[\s\S]*Adana/);
    expect(html).toContain("Kapıda ödeme");
    expect(html).toContain("Kapıyı çalmayın");
  });

  it("validates emails and treats unique/missing-table codes as non-fatal duplicates", () => {
    const { looksLikeEmail, isUniqueViolation, isMissingRelationError } = __orderVendorAlertTest;
    expect(looksLikeEmail("a@b.co")).toBe(true);
    expect(looksLikeEmail("not-an-email")).toBe(false);
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "42501" })).toBe(false);
    expect(isMissingRelationError({ code: "42P01" })).toBe(true);
    expect(isMissingRelationError({ code: "PGRST205" })).toBe(true);
  });

  it("locks vendor alerts with RLS and unique (order_id, channel)", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260826230000_order_vendor_alerts.sql"),
      "utf8",
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.order_vendor_alerts/);
    expect(sql).toMatch(/UNIQUE \(order_id, channel\)/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.order_vendor_alerts FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT SELECT, UPDATE \(read_at\)/);
    expect(sql).toMatch(/GRANT ALL ON TABLE public\.order_vendor_alerts TO service_role/);
    expect(sql).toMatch(/is_vendor_of\(auth\.uid\(\), restaurant_id\)/);
    expect(sql).not.toMatch(/GRANT INSERT/);
    expect(sql).not.toMatch(/TO anon/);
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/);
  });

  it("inserts in-app alerts in the same transaction as orders and publishes realtime", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260827020000_order_vendor_alerts_realtime_trigger.sql"),
      "utf8",
    );
    expect(sql).toMatch(/CREATE TRIGGER order_vendor_alerts_on_order_insert/);
    expect(sql).toMatch(/AFTER INSERT ON public\.orders/);
    expect(sql).toMatch(/ON CONFLICT \(order_id, channel\) DO NOTHING/);
    expect(sql).toMatch(/ALTER PUBLICATION supabase_realtime ADD TABLE public\.order_vendor_alerts/);
    expect(sql).toMatch(/REPLICA IDENTITY FULL/);
    expect(sql).toMatch(/GRANT SELECT, UPDATE \(read_at\) ON TABLE public\.order_vendor_alerts TO authenticated/);
    expect(sql).not.toMatch(/GRANT INSERT/);
    expect(sql).not.toMatch(/TO anon;/);
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/);
  });

  it("subscribes the vendor dashboard to INSERT on order_vendor_alerts", () => {
    const text = readFileSync(join(ROOT, "src/routes/vendor.dashboard.tsx"), "utf8");
    expect(text).toMatch(/event: "INSERT"/);
    expect(text).toMatch(/table: "order_vendor_alerts"/);
    expect(text).toMatch(/filter: `restaurant_id=eq\.\$\{restaurantId\}`/);
    expect(text).toMatch(/vendor-new-order:/);
  });

  it("scopes mark-read to the assigned restaurant", () => {
    const text = readFileSync(join(ROOT, "src/lib/vendor.functions.ts"), "utf8");
    expect(text).toMatch(/markVendorOrderAlertRead/);
    expect(text).toMatch(/\.eq\("restaurant_id", restaurantId\)/);
    expect(text).toMatch(/\.eq\("channel", "in_app"\)/);
  });
});
