import { z } from "zod";

/** Kapıda ödeme — frontend ve veritabanı için tek değer. */
export const CASH_ON_DELIVERY_PAYMENT_METHOD = "cash_on_delivery" as const;

export const createOrderSchema = z.object({
  restaurant_id: z.string().uuid(),
  items: z
    .array(z.object({ menu_item_id: z.string().uuid(), quantity: z.number().int().min(1).max(20) }))
    .min(1)
    .max(40),
  recipient_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(25),
  city: z.string().trim().min(2).max(60),
  district: z.string().trim().min(2).max(60),
  street: z.string().trim().min(4).max(200),
  directions: z.string().trim().max(300).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
  idempotency_key: z.string().uuid().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export function parseCreateOrderInput(input: unknown) {
  return createOrderSchema.safeParse(input);
}

type DbError = { message?: string; code?: string; details?: string } | null | undefined;

export function missingColumnName(error: DbError): string | null {
  if (!error) return null;
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`;
  const fromPg = text.match(/column\s+(?:[\w.]+\.)?["']?(\w+)["']?\s+does not exist/i);
  if (fromPg?.[1]) return fromPg[1];
  const fromPostgrest = text.match(/Could not find the ['"](\w+)['"] column/i);
  if (fromPostgrest?.[1]) return fromPostgrest[1];
  if (error.code === "42703" || error.code === "PGRST204") {
    const fallback = text.match(/['"](\w+)['"]/);
    return fallback?.[1] ?? null;
  }
  return null;
}

export function isUnknownOrderColumnError(error: DbError, column?: string): boolean {
  const name = missingColumnName(error);
  if (!name) return false;
  if (!column) return true;
  return name.toLowerCase() === column.toLowerCase();
}

export function omitOrderColumn<T extends Record<string, unknown>>(row: T, column: string): T {
  if (!(column in row)) return row;
  const next = { ...row };
  delete next[column];
  return next;
}

type InsertError = { message: string; code?: string; details?: string };

export type OmitUnknownColumnInsert<T> = {
  data: T | null;
  error: InsertError | null;
  duplicate: boolean;
  omitted: string[];
};

/**
 * Production şeması henüz migration'daki kolonları içermiyorsa
 * (ör. idempotency_key, payment_method) o kolonları çıkarıp yeniden dener.
 * Unique ihlali (23505) kolon yokluğu değildir.
 */
export async function insertOmittingUnknownColumns<T>(
  insert: (row: Record<string, unknown>) => Promise<{ data: T | null; error: InsertError | null }>,
  payload: Record<string, unknown>,
  options?: { maxAttempts?: number; onOmit?: (column: string) => void },
): Promise<OmitUnknownColumnInsert<T>> {
  let current = { ...payload };
  const omitted: string[] = [];
  const maxAttempts = options?.maxAttempts ?? 8;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await insert(current);
    if (!result.error) return { data: result.data, error: null, duplicate: false, omitted };
    if (result.error.code === "23505" || /duplicate key/i.test(result.error.message)) {
      return { data: null, error: result.error, duplicate: true, omitted };
    }
    const column = missingColumnName(result.error);
    if (column && column in current) {
      omitted.push(column);
      options?.onOmit?.(column);
      current = omitOrderColumn(current, column);
      continue;
    }
    return { data: null, error: result.error, duplicate: false, omitted };
  }
  return { data: null, error: { message: "Sipariş oluşturulamadı." }, duplicate: false, omitted };
}

const inflightOrders = new Map<string, Promise<{ id: string; total: number }>>();

/** Aynı süreçte aynı kullanıcı + idempotency anahtarı tek işleme indirgenir. */
export async function withOrderIdempotencyLock(
  userId: string,
  key: string | null | undefined,
  work: () => Promise<{ id: string; total: number }>,
): Promise<{ id: string; total: number }> {
  if (!key) return work();
  const lockKey = `${userId}:${key}`;
  const existing = inflightOrders.get(lockKey);
  if (existing) return existing;
  const pending = work().finally(() => {
    inflightOrders.delete(lockKey);
  });
  inflightOrders.set(lockKey, pending);
  return pending;
}

export type OrderFailureContext = {
  stage: string;
  userId?: string;
  restaurantId?: string;
  orderId?: string;
  httpStatus?: number;
  error?: unknown;
};

/** Kullanıcıya sızmayan sunucu logu. Token/secret yazılmaz. */
export function logOrderFailure(context: OrderFailureContext): void {
  const err = context.error as DbError & { hint?: string };
  const message =
    err && typeof err === "object"
      ? err.message
      : context.error instanceof Error
        ? context.error.message
        : typeof context.error === "string"
          ? context.error
          : undefined;
  const code = err && typeof err === "object" ? err.code : undefined;
  console.error("[order-create]", {
    endpoint: "createOrder",
    stage: context.stage,
    httpStatus: context.httpStatus ?? 422,
    code,
    message,
    userId: context.userId,
    restaurantId: context.restaurantId,
    orderId: context.orderId,
  });
}
