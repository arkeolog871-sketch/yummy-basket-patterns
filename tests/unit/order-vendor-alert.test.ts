import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as React from "react";
import { render } from "@react-email/render";
import { NewOrderEmail } from "@/lib/email-templates/new-order";
import { __orderVendorAlertTest } from "@/lib/order-vendor-alert.server";

const ROOT = join(import.meta.dirname, "../..");

describe("vendor new-order alerts", () => {
  it("hooks notify after a successful createOrder and does not await it in the success path", () => {
    const text = readFileSync(join(ROOT, "src/lib/orders.functions.ts"), "utf8");
    expect(text).toMatch(/void notifyVendorOfNewOrder\(placed\.id\)/);
    expect(text).toMatch(/order-vendor-alert\.server/);
    const placedAt = text.indexOf("const placed = await placeOrder");
    const notifyAt = text.indexOf("void notifyVendorOfNewOrder");
    const returnAt = text.indexOf("return { ok: true as const, ...placed }");
    expect(placedAt).toBeGreaterThan(0);
    expect(notifyAt).toBeGreaterThan(placedAt);
    expect(returnAt).toBeGreaterThan(notifyAt);
    expect(text).not.toMatch(/await notifyVendorOfNewOrder/);
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

  it("scopes mark-read to the assigned restaurant", () => {
    const text = readFileSync(join(ROOT, "src/lib/vendor.functions.ts"), "utf8");
    expect(text).toMatch(/markVendorOrderAlertRead/);
    expect(text).toMatch(/\.eq\("restaurant_id", restaurantId\)/);
    expect(text).toMatch(/\.eq\("channel", "in_app"\)/);
  });
});
