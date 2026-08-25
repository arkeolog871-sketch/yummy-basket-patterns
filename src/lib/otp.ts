/** Giden ve girilen e-posta doğrulama kodunun hanesi. */
export const OTP_CODE_LENGTH = 6;
/** Kodun geçerlilik süresi (dakika). */
export const OTP_TTL_MINUTES = 10;
/** Yeniden gönderim için minimum bekleme (saniye). */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** Yanlış veya süresi dolmuş kod için kullanıcıya gösterilen metin. */
export const OTP_INVALID_MESSAGE = "Girdiğiniz kod hatalı veya süresi dolmuş";

export type OtpEmailPurpose = "login" | "signup";

/**
 * OTP girdisini sayısal 6 haneye indirger: trim, yalnızca rakam, fazla karakter kesilir.
 * Büyük/küçük harf ve boşluk duyarlılığı kalkar.
 */
export function normalizeOtpCode(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(Math.trunc(raw)).replace(/\D/g, "").slice(0, OTP_CODE_LENGTH);
  }
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\D/g, "").slice(0, OTP_CODE_LENGTH);
}

/** E-posta gövdesinde gösterilecek kod: yalnızca rakam. */
export function formatOtpToken(token?: string | null): string {
  if (!token) return "";
  return String(token).trim().replace(/\D/g, "");
}

export function isCompleteOtpCode(code: string): boolean {
  return new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`).test(code);
}
