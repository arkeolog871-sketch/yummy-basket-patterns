import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseExactOtpCode } from "@/lib/otp";

const identifierSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(6, "Telefon numarası veya e-posta adresi girin")
    .max(120, "Girdi çok uzun"),
});

const GENERIC_SEND_ERROR =
  "Kod e-postası şu anda gönderilemedi. Lütfen birkaç saniye sonra tekrar deneyin.";
const GENERIC_VERIFY_ERROR = "Girdiğiniz kod hatalı veya süresi dolmuş";
const GENERIC_RATE_ERROR = "Çok fazla deneme yaptınız. Lütfen kısa süre sonra tekrar deneyin.";
const MIN_VENDOR_SEND_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function padElapsed(startedAt: number): Promise<void> {
  const wait = MIN_VENDOR_SEND_MS - (Date.now() - startedAt);
  if (wait > 0) await sleep(wait);
}

/** İşletme telefonu veya e-postasına karşılık gelen hesaba tek kullanımlık kod gönderir. */
export const requestVendorLoginCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => identifierSchema.parse(input))
  .handler(async ({ data }) => {
    const startedAt = Date.now();
    try {
      const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
      enforceSensitiveRateLimit("vendor-code-send", 8, 10 * 60 * 1000);
      const { findVendorUser, GENERIC_VENDOR_MASKED_EMAIL } = await import("./vendor-auth.server");
      const { logAudit, tooManyRecentVendorAttempts } = await import("./audit.server");
      const { reserveSend, hashEmail, sendSixDigitOtp, RESEND_COOLDOWN_SECONDS } =
        await import("./otp.server");

      if (await tooManyRecentVendorAttempts()) {
        await padElapsed(startedAt);
        return { ok: false as const, error: GENERIC_RATE_ERROR };
      }

      const vendor = await findVendorUser(data.identifier);
      if (!vendor) {
        const rate = await reserveSend(`${hashEmail(data.identifier)}@guard.local`);
        if (!rate.ok) {
          await padElapsed(startedAt);
          return { ok: false as const, error: rate.error, retryAfterSeconds: rate.retryAfterSeconds };
        }
        await logAudit({
          actorId: null,
          actorEmail: null,
          action: "vendor.login.code_request",
          entity: "vendor_assignments",
          status: "denied",
          detail: { reason: "Telefon/e-postaya bağlı işletme hesabı yok" },
        });
        await padElapsed(startedAt);
        return {
          ok: true as const,
          maskedEmail: GENERIC_VENDOR_MASKED_EMAIL,
          cooldownSeconds: RESEND_COOLDOWN_SECONDS,
        };
      }

      const sent = await sendSixDigitOtp(vendor.email, "login");
      if (!sent.ok) {
        console.error("[vendor-login] kod gönderilemedi", { message: sent.error });
        await logAudit({
          actorId: vendor.userId,
          actorEmail: vendor.email,
          action: "vendor.login.code_request",
          entity: "vendor_assignments",
          entityId: vendor.userId,
          status: "denied",
          detail: { reason: sent.error },
        });
        await padElapsed(startedAt);
        if (sent.retryAfterSeconds != null) {
          return {
            ok: false as const,
            error: sent.error,
            retryAfterSeconds: sent.retryAfterSeconds,
          };
        }
        // SMTP hatasını hesap varlığı sızıntısına çevirme.
        return {
          ok: true as const,
          maskedEmail: GENERIC_VENDOR_MASKED_EMAIL,
          cooldownSeconds: RESEND_COOLDOWN_SECONDS,
        };
      }

      await logAudit({
        actorId: vendor.userId,
        actorEmail: vendor.email,
        action: "vendor.login.code_request",
        entity: "vendor_assignments",
        entityId: vendor.userId,
      });

      await padElapsed(startedAt);
      return {
        ok: true as const,
        maskedEmail: GENERIC_VENDOR_MASKED_EMAIL,
        cooldownSeconds: RESEND_COOLDOWN_SECONDS,
      };
    } catch (error) {
      console.error("[vendor-login] kod isteği başarısız", error);
      await padElapsed(startedAt);
      return { ok: false as const, error: GENERIC_SEND_ERROR };
    }
  });

/** Kodu doğrular ve tarayıcıda oturum kurmak için jetonları döner. */
export const verifyVendorLoginCode = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    identifierSchema
      .extend({
        code: z.union([z.string(), z.number()]),
        termsAccepted: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
      enforceSensitiveRateLimit("vendor-code-verify", 12, 10 * 60 * 1000);
      const { findVendorUser } = await import("./vendor-auth.server");
      const { logAudit, tooManyRecentVendorAttempts } = await import("./audit.server");
      const { OTP_LENGTH_MESSAGE } = await import("./otp");
      const { TERMS_ACCEPTANCE_REQUIRED } = await import("./legal");
      const {
        assertCanVerify,
        registerFailedAttempt,
        clearGuard,
        consumeIssuedOtp,
        messageForOtpInspect,
        createVerifiedSession,
        recordTermsAcceptance,
      } = await import("./otp.server");

      if (await tooManyRecentVendorAttempts()) {
        return { ok: false as const, error: GENERIC_RATE_ERROR };
      }

      if (data.termsAccepted !== true) {
        return { ok: false as const, error: TERMS_ACCEPTANCE_REQUIRED };
      }

      const token = parseExactOtpCode(data.code);
      if (!token) {
        return { ok: false as const, error: OTP_LENGTH_MESSAGE };
      }

      const vendor = await findVendorUser(data.identifier);
      if (!vendor) {
        return { ok: false as const, error: GENERIC_VERIFY_ERROR };
      }

      const allowed = await assertCanVerify(vendor.email);
      if (!allowed.ok) {
        return { ok: false as const, error: GENERIC_VERIFY_ERROR };
      }

      const consumed = await consumeIssuedOtp(vendor.email, token);
      if (consumed !== "match") {
        if (consumed === "mismatch") await registerFailedAttempt(vendor.email);
        await logAudit({
          actorId: vendor.userId,
          actorEmail: vendor.email,
          action: "vendor.login.code_verify",
          entity: "vendor_assignments",
          entityId: vendor.userId,
          status: "denied",
          detail: { reason: consumed },
        });
        return { ok: false as const, error: GENERIC_VERIFY_ERROR };
      }

      const session = await createVerifiedSession(vendor.email);
      if (!session.ok) {
        await logAudit({
          actorId: vendor.userId,
          actorEmail: vendor.email,
          action: "vendor.login.code_verify",
          entity: "vendor_assignments",
          entityId: vendor.userId,
          status: "denied",
          detail: { reason: "Oturum oluşturulamadı" },
        });
        return { ok: false as const, error: GENERIC_VERIFY_ERROR };
      }

      const terms = await recordTermsAcceptance(session.userId);
      if (!terms.ok) return { ok: false as const, error: terms.error };

      await clearGuard(vendor.email);

      await logAudit({
        actorId: vendor.userId,
        actorEmail: vendor.email,
        action: "vendor.login.code_verify",
        entity: "vendor_assignments",
        entityId: vendor.userId,
      });

      return {
        ok: true as const,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      };
    } catch (error) {
      console.error("[vendor-login] kod doğrulama başarısız", error);
      return { ok: false as const, error: GENERIC_VERIFY_ERROR };
    }
  });

/** İşletme kendi şifresini mevcut şifresini doğrulayarak değiştirir. */
export const changeVendorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        currentPassword: z.string().min(1, "Mevcut şifrenizi girin").max(72),
        newPassword: z
          .string()
          .min(8, "Yeni şifre en az 8 karakter olmalı")
          .max(72, "Yeni şifre çok uzun"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertVendor } = await import("./vendor.server");
    const { createServerPublicClient } = await import("./vendor-auth.server");
    const { audited } = await import("./audit.server");

    await assertVendor(context.supabase, context.userId);
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    if (!email) throw new Error("Hesabınıza bağlı e-posta bulunamadı.");

    return audited(
      {
        actorId: context.userId,
        actorEmail: email,
        action: "vendor.password.change",
        entity: "auth.users",
        entityId: context.userId,
        detail: {},
      },
      async () => {
        const check = createServerPublicClient();
        const { error: signInError } = await check.auth.signInWithPassword({
          email,
          password: data.currentPassword,
        });
        if (signInError) throw new Error("Mevcut şifre doğrulanamadı.");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
          password: data.newPassword,
        });
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });
