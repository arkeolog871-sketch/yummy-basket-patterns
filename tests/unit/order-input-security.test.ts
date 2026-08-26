import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("order input cannot set payment or foreign identity", () => {
  it("rejects client-supplied totals and payment fields at the Zod boundary", () => {
    const text = readFileSync(join(ROOT, "src/lib/order-placement.ts"), "utf8");
    const schema = text.slice(
      text.indexOf("export const createOrderSchema"),
      text.indexOf("export type CreateOrderInput"),
    );
    expect(schema).toMatch(/z\.object/);
    expect(schema).not.toMatch(/payment_status/);
    expect(schema).not.toMatch(/subtotal/);
    expect(schema).not.toMatch(/\btotal\b/);
    expect(schema).not.toMatch(/delivery_fee/);
    expect(schema).not.toMatch(/user_id/);
    expect(text).toMatch(/CASH_ON_DELIVERY_PAYMENT_METHOD/);
    expect(text).toMatch(/omitOrderColumn/);
    expect(text).toMatch(/isUnknownOrderColumnError/);
    expect(text).toMatch(/insertOmittingUnknownColumns/);
    expect(text).toMatch(/withOrderIdempotencyLock/);
    const orders = readFileSync(join(ROOT, "src/lib/orders.functions.ts"), "utf8");
    expect(orders).toMatch(/p_user_id: userId/);
    expect(orders).not.toMatch(/data\.user_id/);
    expect(orders).toMatch(/supabase\.rpc\("place_customer_order"/);
    expect(orders).toMatch(/supabaseAdmin\.rpc\("place_customer_order"/);
    expect(orders.indexOf('supabase.rpc("place_customer_order"')).toBeLessThan(
      orders.indexOf('supabaseAdmin.rpc("place_customer_order"'),
    );
  });

  it("vendor mutations ignore client restaurant_id and use assertVendor", () => {
    const text = readFileSync(join(ROOT, "src/lib/vendor.functions.ts"), "utf8");
    expect(text).toMatch(/const restaurantId = await assertVendor/);
    expect(text).not.toMatch(/data\.restaurant_id/);
  });

  it("does not accept client-supplied user_id, stock, or payment on createOrder", () => {
    const text = readFileSync(join(ROOT, "src/lib/orders.functions.ts"), "utf8");
    expect(text).toMatch(/idempotency_key/);
    expect(text).toMatch(/place_customer_order/);
    expect(text).toMatch(/planStockDecrement/);
    expect(text).toMatch(/findIdempotentOrder/);
    expect(text).toMatch(/gte\("stock_quantity"/);
    expect(text).not.toMatch(/stock_quantity:\s*data/);
    expect(text).not.toMatch(/p_user_id:\s*data/);
    expect(text).not.toMatch(/idempotency_key:\s*_ignored/);
    expect(text).toMatch(/insertOmittingUnknownColumns/);
    expect(text).toMatch(/withOrderIdempotencyLock/);
  });

  it("clears the cart only after a successful createOrder response", () => {
    const text = readFileSync(join(ROOT, "src/routes/odeme.tsx"), "utf8");
    expect(text).toMatch(/onSuccess/);
    expect(text).toMatch(/cart\.clear\(\)/);
    const clearAt = text.indexOf("cart.clear()");
    const successAt = text.indexOf("onSuccess");
    expect(successAt).toBeGreaterThan(0);
    expect(clearAt).toBeGreaterThan(successAt);
    expect(text).toMatch(/place\.isPending/);
    expect(text).toMatch(/submittingRef/);
    expect(text).toMatch(/cash_on_delivery|Kapıda ödeme/);
  });
});
