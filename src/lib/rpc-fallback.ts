/** Yalnızca fonksiyon gerçekten yoksa true. Kolon/RLS/iş kuralı hatalarında fallback açılmaz. */
export function isMissingRpcError(error: { message?: string; code?: string } | null | undefined): boolean {
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
