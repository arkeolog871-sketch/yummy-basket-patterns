import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { OTP_INVALID_MESSAGE, isCompleteOtpCode, normalizeOtpCode } from "@/lib/otp";

const sendSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(255),
  allowSignUp: z.boolean().optional(),
  purpose: z.enum(["login", "signup"]).optional(),
});

const verifySchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(255),
  code: z.union([z.string(), z.number()]),
});

/**
 * E-posta adresine 6 haneli sayısal doğrulama kodu gönderir.
 * Kod sunucuda üretilip özetlenerek saklanır; istemciye veya cevaba yazılmaz.
 */
export const sendEmailVerificationCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => sendSchema.parse(input))
  .handler(async ({ data }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    enforceSensitiveRateLimit("otp-send", 8, 10 * 60 * 1000);
    const { sendSixDigitOtp, ensureAuthUser, findAuthUserIdByEmail, RESEND_COOLDOWN_SECONDS } =
      await import("./otp.server");

    if (data.allowSignUp) {
      await ensureAuthUser(data.email);
    } else if (!(await findAuthUserIdByEmail(data.email))) {
      return {
        ok: false as const,
        error: "Doğrulama kodu şu anda gönderilemedi. Lütfen birkaç saniye sonra tekrar deneyin.",
      };
    }

    const sent = await sendSixDigitOtp(data.email, data.purpose ?? (data.allowSignUp ? "signup" : "login"));
    if (!sent.ok) return { ok: false as const, error: sent.error, retryAfterSeconds: sent.retryAfterSeconds };
    return { ok: true as const, cooldownSeconds: RESEND_COOLDOWN_SECONDS };
  });

/**
 * Girilen kodu doğrular. Doğruysa e-posta doğrulanmış sayılır ve oturum jetonları döner.
 * Kod yanlışsa hesap doğrulanmaz; 5 hatalı denemede mevcut kod geçersiz olur.
 */
export const verifyEmailVerificationCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    enforceSensitiveRateLimit("otp-verify", 12, 10 * 60 * 1000);
    const {
      assertCanVerify,
      registerFailedAttempt,
      clearGuard,
      matchIssuedOtp,
      createVerifiedSession,
      MAX_FAILED_ATTEMPTS,
      OTP_INVALID_MESSAGE: invalidMessage,
    } = await import("./otp.server");

    const token = normalizeOtpCode(data.code);
    if (!isCompleteOtpCode(token)) {
      return { ok: false as const, error: "Doğrulama kodu 6 haneli olmalıdır." };
    }

    const allowed = await assertCanVerify(data.email);
    if (!allowed.ok) return { ok: false as const, error: allowed.error };

    const matched = await matchIssuedOtp(data.email, token);
    if (!matched) {
      const attempts = await registerFailedAttempt(data.email);
      const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
      return {
        ok: false as const,
        error: remaining > 0 ? invalidMessage : "Doğrulama kodu hatalı. Mevcut kod geçersiz kıldı — yeni kod isteyin.",
      };
    }

    const session = await createVerifiedSession(data.email);
    if (!session.ok) return { ok: false as const, error: session.error };

    await clearGuard(data.email);

    return {
      ok: true as const,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      userId: session.userId,
    };
  });

const registerSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(255),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı").max(72),
  fullName: z.string().trim().min(2, "Ad soyad girin").max(120),
  phone: z.string().trim().min(10, "Telefon numarası en az 10 haneli olmalı").max(20),
});

/**
 * Kayıt: hesap doğrulanmamış olarak oluşturulur ve TEK doğrulama akışı olan
 * 6 haneli kod gönderilir. E-posta gerçekten gönderilemezse ok:false döner.
 */
export const registerWithEmailCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    enforceSensitiveRateLimit("register", 6, 10 * 60 * 1000);
    const { createUnverifiedAccount } = await import("./otp.server");
    const created = await createUnverifiedAccount(data);
    if (!created.ok) return { ok: false as const, error: created.error };

    const sent = await sendEmailVerificationCode({
      data: { email: data.email, allowSignUp: true, purpose: "signup" },
    });
    if (!sent.ok) {
      return {
        ok: false as const,
        error: `Hesabınız oluşturuldu ancak kod gönderilemedi: ${sent.error}`,
      };
    }
    return { ok: true as const, cooldownSeconds: sent.cooldownSeconds };
  });

export { OTP_INVALID_MESSAGE };
