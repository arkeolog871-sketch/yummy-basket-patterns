import { createServerFn } from "@tanstack/react-start";
import { OTP_INVALID_MESSAGE, OTP_LENGTH_MESSAGE, parseExactOtpCode } from "@/lib/otp";
import { registerSchema, sendOtpSchema, verifyOtpSchema } from "@/lib/otp-schemas";

/**
 * E-posta adresine 6 haneli sayısal doğrulama kodu gönderir.
 * Kod sunucuda üretilip özetlenerek saklanır; istemciye veya cevaba yazılmaz.
 */
export const sendEmailVerificationCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => sendOtpSchema.parse(input))
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
  .validator((input: unknown) => verifyOtpSchema.parse(input))
  .handler(async ({ data }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    enforceSensitiveRateLimit("otp-verify", 12, 10 * 60 * 1000);
    const { TERMS_ACCEPTANCE_REQUIRED } = await import("./legal");
    const {
      assertCanVerify,
      registerFailedAttempt,
      clearGuard,
      consumeIssuedOtp,
      messageForOtpInspect,
      createVerifiedSession,
      recordTermsAcceptance,
      MAX_FAILED_ATTEMPTS,
    } = await import("./otp.server");

    if (data.termsAccepted !== true) {
      return { ok: false as const, error: TERMS_ACCEPTANCE_REQUIRED };
    }

    const token = parseExactOtpCode(data.code);
    if (!token) {
      return { ok: false as const, error: OTP_LENGTH_MESSAGE };
    }

    const allowed = await assertCanVerify(data.email);
    if (!allowed.ok) return { ok: false as const, error: allowed.error };

    const inspected = await consumeIssuedOtp(data.email, token);
    if (inspected !== "match") {
      if (inspected === "mismatch") {
        const attempts = await registerFailedAttempt(data.email);
        const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
        return {
          ok: false as const,
          error:
            remaining > 0
              ? messageForOtpInspect(inspected)
              : "Doğrulama kodu hatalı. Mevcut kod geçersiz kıldı — yeni kod isteyin.",
        };
      }
      return { ok: false as const, error: messageForOtpInspect(inspected) };
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
