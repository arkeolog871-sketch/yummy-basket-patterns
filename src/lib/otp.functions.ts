import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sendSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(255),
  allowSignUp: z.boolean().optional(),
});

const verifySchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(255),
  code: z.string().trim().max(20),
});

/**
 * E-posta adresine 6 haneli doğrulama kodu gönderir.
 * Kod sunucuda üretilip saklanır; istemciye veya cevaba hiçbir şekilde yazılmaz.
 */
export const sendEmailVerificationCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sendSchema.parse(input))
  .handler(async ({ data }) => {
    const { reserveSend, createServerAuthClient, RESEND_COOLDOWN_SECONDS } = await import(
      "./otp.server"
    );

    const reserved = await reserveSend(data.email);
    if (!reserved.ok) return { ok: false as const, error: reserved.error };

    const supabase = createServerAuthClient();
    let error: { message: string; status?: number } | null = null;
    try {
      const result = await supabase.auth.signInWithOtp({
        email: data.email,
        options: { shouldCreateUser: data.allowSignUp ?? false },
      });
      error = result.error
        ? { message: result.error.message, status: result.error.status }
        : null;
    } catch (thrown) {
      error = { message: thrown instanceof Error ? thrown.message : String(thrown) };
    }
    if (error) {
      // Gönderim gerçekten başarısız — ayrıntı sunucu loglarına yazılır.
      console.error("[otp] doğrulama kodu gönderilemedi", {
        status: error.status ?? null,
        message: error.message,
      });
      const hookFailure = /hook/i.test(error.message);
      return {
        ok: false as const,
        error:
          error.status === 429
            ? "Çok sık kod istediniz. Lütfen kısa süre sonra tekrar deneyin."
            : hookFailure
              ? "E-posta gönderim servisine ulaşılamadı, kod gönderilemedi. Lütfen tekrar deneyin."
              : "Doğrulama kodu şu anda gönderilemedi. Lütfen birkaç saniye sonra tekrar deneyin.",
      };
    }

    return { ok: true as const, cooldownSeconds: RESEND_COOLDOWN_SECONDS };
  });

/**
 * Girilen kodu doğrular. Doğruysa e-posta doğrulanmış sayılır ve oturum jetonları döner.
 * Kod yanlışsa hesap doğrulanmaz; 5 hatalı denemede mevcut kod geçersiz olur.
 */
export const verifyEmailVerificationCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data }) => {
    const {
      assertCanVerify,
      registerFailedAttempt,
      clearGuard,
      createServerAuthClient,
      MAX_FAILED_ATTEMPTS,
    } = await import("./otp.server");

    const token = data.code.replace(/\D/g, "");
    if (token.length !== 6) {
      return { ok: false as const, error: "Doğrulama kodu 6 haneli olmalıdır." };
    }

    const allowed = await assertCanVerify(data.email);
    if (!allowed.ok) return { ok: false as const, error: allowed.error };

    const supabase = createServerAuthClient();
    const { data: verified, error } = await supabase.auth.verifyOtp({
      email: data.email,
      token,
      type: "email",
    });

    if (error || !verified.session) {
      const expired = /expire|süre/i.test(error?.message ?? "");
      const attempts = await registerFailedAttempt(data.email);
      if (expired) {
        return {
          ok: false as const,
          error: "Doğrulama kodunun süresi doldu. Yeni kod gönderin.",
        };
      }
      const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
      return {
        ok: false as const,
        error:
          remaining > 0
            ? `Doğrulama kodu hatalı. Kalan deneme: ${remaining}`
            : "Doğrulama kodu hatalı. Mevcut kod geçersiz kıldı — yeni kod isteyin.",
      };
    }

    await clearGuard(data.email);

    return {
      ok: true as const,
      accessToken: verified.session.access_token,
      refreshToken: verified.session.refresh_token,
      userId: verified.user?.id ?? "",
    };
  });
