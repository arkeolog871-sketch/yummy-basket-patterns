import { createServerFn } from "@tanstack/react-start";
import {
  OTP_INVALID_MESSAGE,
  OTP_LENGTH_MESSAGE,
  OTP_LOCK_MESSAGE,
  PHONE_REQUIRED_MESSAGE,
  parseExactOtpCode,
} from "@/lib/otp";
import { otpSendSchema, otpVerifySchema, registerSchema } from "@/lib/otp-schemas";

/**
 * E-posta adresine 6 haneli sayısal doğrulama kodu gönderir.
 * Kod sunucuda üretilip özetlenerek saklanır; istemciye veya cevaba yazılmaz.
 */
export const sendEmailVerificationCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => otpSendSchema.parse(input))
  .handler(async ({ data }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    await enforceSensitiveRateLimit("otp-send", 8, 10 * 60 * 1000);
    const { sendSixDigitOtp, findAuthUserIdByEmail, reserveSend, RESEND_COOLDOWN_SECONDS } =
      await import("./otp.server");

    if (!(await findAuthUserIdByEmail(data.email))) {
      const reserved = await reserveSend(data.email);
      if (!reserved.ok) {
        return {
          ok: false as const,
          error: reserved.error,
          retryAfterSeconds: reserved.retryAfterSeconds,
        };
      }
      return { ok: true as const, cooldownSeconds: RESEND_COOLDOWN_SECONDS };
    }

    const sent = await sendSixDigitOtp(
      data.email,
      data.purpose ?? (data.allowSignUp ? "signup" : "login"),
    );
    if (!sent.ok)
      return { ok: false as const, error: sent.error, retryAfterSeconds: sent.retryAfterSeconds };
    return { ok: true as const, cooldownSeconds: RESEND_COOLDOWN_SECONDS };
  });

/**
 * Girilen kodu doğrular. Doğruysa e-posta doğrulanmış sayılır ve oturum jetonları döner.
 * Kod yanlışsa hesap doğrulanmaz; 5 hatalı denemede mevcut kod geçersiz olur.
 * Eşleşen kod oturum üretilmeden önce tek kullanımlık tüketilir.
 */
export const verifyEmailVerificationCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => otpVerifySchema.parse(input))
  .handler(async ({ data }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    await enforceSensitiveRateLimit("otp-verify", 12, 10 * 60 * 1000);
    const { TERMS_ACCEPTANCE_REQUIRED } = await import("./legal");
    const {
      assertCanVerify,
      registerFailedAttempt,
      clearGuard,
      consumeIssuedOtp,
      createVerifiedSession,
      recordTermsAcceptance,
      hasPhoneOnFile,
      MAX_FAILED_ATTEMPTS,
    } = await import("./otp.server");

    if (data.termsAccepted !== true) {
      return { ok: false as const, error: TERMS_ACCEPTANCE_REQUIRED };
    }

    const token = parseExactOtpCode(data.code);
    if (!token) {
      return { ok: false as const, error: OTP_LENGTH_MESSAGE };
    }

    // Kayıt akışı telefonu zaten zorunlu tutar; bu, o akışı atlayan hiçbir
    // hesabın telefon girmeden e-posta doğrulamasını tamamlayamamasını garanti eder.
    if (!(await hasPhoneOnFile(data.email))) {
      return { ok: false as const, error: PHONE_REQUIRED_MESSAGE };
    }

    const allowed = await assertCanVerify(data.email);
    if (!allowed.ok) return { ok: false as const, error: allowed.error };

    const consumed = await consumeIssuedOtp(data.email, token);
    if (consumed !== "match") {
      if (consumed === "mismatch") {
        const attempts = await registerFailedAttempt(data.email);
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          return { ok: false as const, error: OTP_LOCK_MESSAGE };
        }
      }
      return { ok: false as const, error: OTP_INVALID_MESSAGE };
    }

    const session = await createVerifiedSession(data.email);
    if (!session.ok) return { ok: false as const, error: session.error };

    const terms = await recordTermsAcceptance(session.userId);
    if (!terms.ok) return { ok: false as const, error: terms.error };

    await clearGuard(data.email);

    return {
      ok: true as const,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      userId: session.userId,
    };
  });

/**
 * Kayıt: hesap doğrulanmamış olarak oluşturulur ve TEK doğrulama akışı olan
 * 6 haneli kod gönderilir. E-posta gerçekten gönderilemezse ok:false döner.
 */
export const registerWithEmailCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    await enforceSensitiveRateLimit("register", 6, 10 * 60 * 1000);
    const { createUnverifiedAccount } = await import("./otp.server");
    const created = await createUnverifiedAccount(data);
    if (!created.ok && !("existing" in created)) {
      return { ok: false as const, error: created.error };
    }
    const existing = !created.ok;

    const sent = await sendEmailVerificationCode({
      data: {
        email: data.email,
        allowSignUp: !existing,
        purpose: existing ? "login" : "signup",
      },
    });
    if (!sent.ok) {
      return {
        ok: false as const,
        error: sent.error || "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin.",
        retryAfterSeconds: sent.retryAfterSeconds,
      };
    }
    return { ok: true as const, cooldownSeconds: sent.cooldownSeconds };
  });

export { OTP_INVALID_MESSAGE };
