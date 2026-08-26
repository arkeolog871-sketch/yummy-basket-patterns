import { describe, expect, it } from "vitest";
import { planStockDecrement } from "@/lib/orders-stock";

describe("order fallback stock planning", () => {
  it("rejects insufficient stock and leaves unlimited stock unchanged", () => {
    expect(planStockDecrement(2, 3)).toEqual({ ok: false, reason: "insufficient" });
    expect(planStockDecrement(0, 1)).toEqual({ ok: false, reason: "insufficient" });
    expect(planStockDecrement(null, 2)).toEqual({ ok: true, unlimited: true });
    expect(planStockDecrement(undefined, 2)).toEqual({ ok: true, unlimited: true });
    expect(planStockDecrement(5, 2)).toEqual({ ok: true, unlimited: false, next: 3 });
  });
});
