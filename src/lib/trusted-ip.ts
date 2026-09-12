/**
 * Hız sınırı için istemci kimliği.
 *
 * Yalnızca Cloudflare'in yazdığı `cf-connecting-ip` güvenilir; `x-forwarded-for`
 * ve `x-real-ip` istemci tarafından uydurulabildiği için okunmaz — aksi hâlde
 * saldırgan her istekte başlığı değiştirip OTP gönderme/doğrulama sınırlarını
 * sonsuza kadar döndürebilirdi.
 *
 * Başlık yoksa sabit `"unknown"` anahtarına düşülür. Daha önce burada isteğe
 * özgü rastgele bir UUID üretiliyordu; amaç, tüm istemcileri tek kovada
 * birleştirip kendi kendine hizmet reddi yaratmamaktı. Ama rastgele anahtar her
 * isteği kendi kovasına koyduğu için hız sınırını o durumda tamamen etkisiz
 * bırakıyordu: kimlik doğrulaması gerektirmeyen tüm uç noktalar (otp-send,
 * otp-verify, vendor-code-verify, register, order-create) tek savunmalarını
 * kaybediyordu. Üretim Cloudflare arkasında olduğu için bu dal normalde hiç
 * çalışmaz; çalışırsa da doğru davranış, sınırı kaldırmak değil paylaşılan bir
 * kovaya düşmektir — görünür bir yavaşlama, sessiz bir kimlik doğrulama
 * atlatmasından iyidir.
 */
export function trustedClientAddress(
  getHeader: (name: string) => string | null | undefined,
): string {
  const cf = getHeader("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return "unknown";
}
