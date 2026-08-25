import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("order input cannot set payment or foreign identity", () => {
  it("rejects client-supplied totals and payment fields at the Zod boundary", () => {
    const text = readFileSync(join(ROOT, "src/lib/orders.functions.ts"), "utf8");
    const schema = text.slice(
      text.indexOf("const createOrderSchema"),
      text.indexOf("type AuthContext"),
    );
    expect(schema).toMatch(/z\.object/);
    expect(schema).not.toMatch(/payment_status/);
    expect(schema).not.toMatch(/subtotal/);
    expect(schema).not.toMatch(/\btotal\b/);
    expect(schema).not.toMatch(/delivery_fee/);
    expect(schema).not.toMatch(/user_id/);
    expect(text).toMatch(/p_user_id: userId/);
    expect(text).not.toMatch(/data\.user_id/);
  });

  it("vendor mutations ignore client restaurant_id and use assertVendor", () => {
    const text = readFileSync(join(ROOT, "src/lib/vendor.functions.ts"), "utf8");
    expect(text).toMatch(/const restaurantId = await assertVendor/);
    expect(text).not.toMatch(/data\.restaurant_id/);
  });
});
