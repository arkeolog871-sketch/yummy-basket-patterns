import { describe, expect, it } from "vitest";
import { parseCreateOrderInput } from "@/lib/order-placement";
import {
  CASH_ON_DELIVERY_PAYMENT_METHOD,
  isUnknownOrderColumnError,
  missingColumnName,
  omitOrderColumn,
} from "@/lib/order-placement";

describe("order placement column fallback", () => {
  it("parses Postgres and PostgREST missing-column errors", () => {
    expect(
      missingColumnName({
        code: "42703",
        message: 'column orders.idempotency_key does not exist',
      }),
    ).toBe("idempotency_key");
    expect(
      missingColumnName({
        code: "PGRST204",
        message: "Could not find the 'payment_method' column of 'orders' in the schema cache",
      }),
    ).toBe("payment_method");
    expect(isUnknownOrderColumnError({ code: "42703", message: "column orders.idempotency_key does not exist" }, "idempotency_key")).toBe(true);
    expect(isUnknownOrderColumnError({ code: "23502", message: "null value" }, "idempotency_key")).toBe(false);
    expect(
      missingColumnName({
        code: "23505",
        message: 'duplicate key value violates unique constraint "orders_user_idempotency_key_uidx"',
      }),
    ).toBeNull();
  });

  it("strips only the missing column so a second insert can succeed", () => {
    const row = {
      user_id: "u1",
      total: 2000,
      idempotency_key: "k1",
      payment_method: CASH_ON_DELIVERY_PAYMENT_METHOD,
    };
    const withoutKey = omitOrderColumn(row, "idempotency_key");
    expect(withoutKey).toEqual({
      user_id: "u1",
      total: 2000,
      payment_method: "cash_on_delivery",
    });
    expect(row.idempotency_key).toBe("k1");
  });

  it("uses cash_on_delivery as the only checkout payment method", () => {
    expect(CASH_ON_DELIVERY_PAYMENT_METHOD).toBe("cash_on_delivery");
  });

  it("retries insert after production-missing idempotency_key then payment_method", async () => {
    const { insertOmittingUnknownColumns } = await import("@/lib/order-placement");
    const attempts: Array<Record<string, unknown>> = [];
    const result = await insertOmittingUnknownColumns<{ id: string }>(
      async (row) => {
        attempts.push({ ...row });
        if ("idempotency_key" in row) {
          return {
            data: null,
            error: { code: "42703", message: "column orders.idempotency_key does not exist" },
          };
        }
        if ("payment_method" in row) {
          return {
            data: null,
            error: {
              code: "42703",
              message: "column orders.payment_method does not exist",
            },
          };
        }
        return { data: { id: "order-1" }, error: null };
      },
      {
        user_id: "u1",
        restaurant_id: "r1",
        total: 2000,
        payment_status: "unpaid",
        payment_method: CASH_ON_DELIVERY_PAYMENT_METHOD,
        idempotency_key: "k1",
      },
    );
    expect(result.duplicate).toBe(false);
    expect(result.data).toEqual({ id: "order-1" });
    expect(result.omitted).toEqual(["idempotency_key", "payment_method"]);
    expect(attempts).toHaveLength(3);
    expect(attempts[2]).toEqual({
      user_id: "u1",
      restaurant_id: "r1",
      total: 2000,
      payment_status: "unpaid",
    });
  });

  it("does not treat unique violation as a missing column", async () => {
    const { insertOmittingUnknownColumns } = await import("@/lib/order-placement");
    const result = await insertOmittingUnknownColumns(
      async () => ({
        data: null,
        error: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "orders_user_idempotency_key_uidx"',
        },
      }),
      { idempotency_key: "k1", user_id: "u1" },
    );
    expect(result.duplicate).toBe(true);
    expect(result.omitted).toEqual([]);
  });

  it("coalesces in-flight orders with the same idempotency key", async () => {
    const { withOrderIdempotencyLock } = await import("@/lib/order-placement");
    let runs = 0;
    const work = () =>
      new Promise<{ id: string; total: number }>((resolve) => {
        runs += 1;
        setTimeout(() => resolve({ id: "same", total: 2000 }), 20);
      });
    const [a, b] = await Promise.all([
      withOrderIdempotencyLock("user-1", "key-1", work),
      withOrderIdempotencyLock("user-1", "key-1", work),
    ]);
    expect(runs).toBe(1);
    expect(a).toEqual(b);
  });
});

describe("createOrder input validation", () => {
  const valid = {
    restaurant_id: "557b3793-1b1c-4198-817a-a31f6db43eb4",
    items: [{ menu_item_id: "11111111-1111-1111-1111-111111111111", quantity: 1 }],
    recipient_name: "Ahmet Yılmaz",
    phone: "05430000000",
    city: "Diyarbakır",
    district: "Silvan",
    street: "Boyunlu mahallesi no 1",
  };

  it("accepts a complete kapıda-ödeme payload", () => {
    expect(parseCreateOrderInput(valid).success).toBe(true);
  });

  it("rejects empty cart, invalid ids, and client-supplied totals/payment", () => {
    expect(parseCreateOrderInput({ ...valid, items: [] }).success).toBe(false);
    expect(parseCreateOrderInput({ ...valid, restaurant_id: "not-a-uuid" }).success).toBe(false);
    expect(parseCreateOrderInput({ ...valid, street: "x" }).success).toBe(false);
    const parsed = parseCreateOrderInput({
      ...valid,
      total: 1,
      payment_status: "paid",
      user_id: "22222222-2222-2222-2222-222222222222",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("total");
      expect(parsed.data).not.toHaveProperty("payment_status");
      expect(parsed.data).not.toHaveProperty("user_id");
    }
  });
});
