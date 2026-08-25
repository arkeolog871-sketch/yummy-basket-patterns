import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function source(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("server-side IDOR / object-level authorization", () => {
  it("scopes customer address reads and writes to the authenticated user id", () => {
    const text = source("src/lib/addresses.functions.ts");
    expect(text).toMatch(/requireSupabaseAuth/);
    expect(text).toMatch(/assertVerifiedEmail/);
    expect(text).toMatch(/\.eq\("user_id", context\.userId\)/);
    expect(text).toMatch(/\.eq\("user_id", userId\)/);
    expect(text).toMatch(/user_id: userId/);
    expect(text).not.toMatch(/data\.user_id/);
  });

  it("scopes customer order reads to owner and recomputes order writes server-side", () => {
    const text = source("src/lib/orders.functions.ts");
    expect(text).toMatch(/requireSupabaseAuth/);
    expect(text).toMatch(/assertVerifiedEmail/);
    expect(text).toMatch(/\.eq\("user_id", context\.userId\)/);
    expect(text).toMatch(/place_customer_order/);
    expect(text).toMatch(/p_user_id: userId/);
  });

  it("scopes vendor dashboard and mutations to the assigned restaurant", () => {
    const dashboard = source("src/lib/vendor.functions.ts");
    const media = source("src/lib/vendor-media.functions.ts");
    expect(dashboard).toMatch(/assertVendor/);
    expect(dashboard).toMatch(/\.eq\("restaurant_id", restaurantId\)/);
    expect(dashboard).toMatch(/Bu sipariş işletmenize ait değil/);
    expect(dashboard).toMatch(/Bu ürün işletmenize ait değil/);
    expect(media).toMatch(/assertVendor/);
    expect(media).toMatch(/\.eq\("restaurant_id", restaurantId\)/);
  });

  it("does not expose payment mutation APIs to customers", () => {
    const orders = source("src/lib/orders.functions.ts");
    expect(orders).not.toMatch(/payment_status:\s*data/);
    expect(orders).not.toMatch(/\.update\(\{[^}]*payment_status/);
    expect(source("src/lib/vendor.functions.ts")).not.toMatch(/payment_status:\s*data/);
  });

  it("keeps founder profile/user changes behind assertFounder", () => {
    const text = source("src/lib/founder.functions.ts");
    expect(text).toMatch(/assertFounder/);
    expect(text).toMatch(/from\("profiles"\)/);
  });
});
