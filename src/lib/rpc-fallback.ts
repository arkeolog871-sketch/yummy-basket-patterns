import { isUnknownOrderColumnError } from "./order-placement";

type RpcError = { message?: string; code?: string; details?: string } | null | undefined;

/** Yalnızca fonksiyon gerçekten yoksa true. Kolon/RLS/iş kuralı hatalarında fallback açılmaz. */
export function isMissingRpcError(error: RpcError): boolean {
  if (!error) return false;
  if (error.code === "PGRST204" || error.code === "42703" || error.code === "42501") return false;
  const message = error.message ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /function .* does not exist/i.test(message) ||
    /Could not find the function/i.test(message)
  );
}

/**
 * PostgREST şema önbelleği Postgres'ten gerideyse RPC görünür ama INSERT
 * payment_method/idempotency_key kolonunda 42703/PGRST204 döner. Bu durumda
 * tablo INSERT fallback'i (eksik kolonu yutarak) kullanılabilir.
 */
export function isOrderRpcSchemaMismatchError(error: RpcError): boolean {
  if (!error) return false;
  if (isUnknownOrderColumnError(error, "payment_method")) return true;
  if (isUnknownOrderColumnError(error, "idempotency_key")) return true;
  return false;
}

export function shouldUseOrderPlacementFallback(error: RpcError): boolean {
  return isMissingRpcError(error) || isOrderRpcSchemaMismatchError(error);
}
