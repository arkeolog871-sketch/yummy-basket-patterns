/** Migration henüz uygulanmadıysa PostgREST/Postgres bilinmeyen fonksiyon hatası döner. */
export function isMissingRpcError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /function .* does not exist/i.test(message) ||
    /Could not find the function/i.test(message)
  );
}
