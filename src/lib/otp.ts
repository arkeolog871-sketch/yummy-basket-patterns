/** Giden ve girilen e-posta doğrulama kodunun hanesi. */
export const OTP_CODE_LENGTH = 6;
/** Kodun geçerlilik süresi (dakika). */
export const OTP_TTL_MINUTES = 10;
/** Yeniden gönderim için minimum bekleme (saniye). */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** Yanlış veya süresi dolmuş kod için kullanıcıya gösterilen metin. */
export const OTP_INVALID_MESSAGE = "Girdiğiniz kod hatalı veya süresi dolmuş";
/** Kod e-posta servisine iletilemediğinde kullanıcıya gösterilir; teknik ayrıntı loglanır. */
export const EMAIL_SEND_FAILED_MESSAGE =
  "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin.";
/** Yanlış / süresi dolmuş / eksik kod aynı metin — OTP enumeration olmasın. */
export const OTP_WRONG_MESSAGE = OTP_INVALID_MESSAGE;
export const OTP_EXPIRED_MESSAGE = OTP_INVALID_MESSAGE;
export const OTP_LENGTH_MESSAGE = "Doğrulama kodu 6 haneli olmalıdır.";
/** 5 hatalı deneme sonrası; kodun doğru olup olmadığını söylemez. */
export const OTP_LOCK_MESSAGE =
  "Çok fazla hatalı deneme yaptınız. Mevcut kod geçersiz — yeni kod isteyin.";
/** Telefon numarası kayıtlı olmadan e-posta doğrulaması tamamlanamaz. */
export const PHONE_REQUIRED_MESSAGE =
  "E-posta doğrulaması için önce telefon numaranızı girip kaydetmeniz gerekir.";

export type OtpEmailPurpose = "login" | "signup";

function digitsOnly(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(Math.trunc(Math.abs(raw))).replace(/\D/g, "");
  }
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\D/g, "");
}

/**
 * OTP girdisini sayısal 6 haneye indirger: trim, yalnızca rakam, fazla karakter kesilir.
 * Büyük/küçük harf ve boşluk duyarlılığı kalkar. Yalnızca yazım/yapıştırma için;
 * sunucu doğrulaması `parseExactOtpCode` kullanır.
 */
export function normalizeOtpCode(raw: unknown): string {
  return digitsOnly(raw).slice(0, OTP_CODE_LENGTH);
}

/**
 * Doğrulama için tam 6 rakam ister. 5/7 hane, harf, boş veya kesilmiş kod reddedilir.
 * Sayısal JSON girdilerinde baştaki sıfırlar kaybolacağı için 6 haneden kısa sayı da reddedilir.
 */
export function parseExactOtpCode(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const digits = String(Math.trunc(Math.abs(raw))).replace(/\D/g, "");
    if (digits.length !== OTP_CODE_LENGTH) return null;
    return digits;
  }
  if (typeof raw !== "string") return null;
  if (/[a-zA-Z]/.test(raw)) return null;
  const digits = raw.trim().replace(/\D/g, "");
  if (digits.length !== OTP_CODE_LENGTH) return null;
  return digits;
}

/** E-posta gövdesinde gösterilecek kod: yalnızca rakam. */
export function formatOtpToken(token?: string | null): string {
  if (!token) return "";
  return String(token).trim().replace(/\D/g, "");
}

export function isCompleteOtpCode(code: string): boolean {
  return new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`).test(code);
}
