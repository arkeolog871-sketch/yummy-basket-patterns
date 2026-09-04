/**
 * Cloudflare'in yazdığı istemci IP'si; sahte X-Forwarded-For ile limit aşımı
 * olmasın. Bu başlık eksikse (Cloudflare önünde değilse — beklenmeyen bir
 * durum, Worker'a yalnızca CF kenarından istek gelir) sabit bir "unknown"
 * anahtarına düşmek, o durumda TÜM istemcileri tek bir kovada birleştirip
 * kendi kendine hizmet reddine (rate limit'in herkesi bloklaması) yol açardı.
 * Bunun yerine her çağrıya özgü rastgele bir anahtar üretilir: gerçekleşirse
 * yalnızca o isteğin sınırlaması etkisiz kalır, paylaşılan bir kova oluşmaz.
 */
export function trustedClientAddress(getHeader: (name: string) => string | null | undefined): string {
  const cf = getHeader("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return `unknown:${crypto.randomUUID()}`;
}
