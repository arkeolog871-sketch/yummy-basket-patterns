/** Cloudflare'in yazdığı istemci IP'si; sahte X-Forwarded-For ile limit aşımı olmasın. */
export function trustedClientAddress(getHeader: (name: string) => string | null | undefined): string {
  const cf = getHeader("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return "unknown";
}
