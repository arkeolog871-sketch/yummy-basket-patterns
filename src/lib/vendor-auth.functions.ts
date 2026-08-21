import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const identifierSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(6, "Telefon numarası veya e-posta adresi girin")
    .max(120, "Girdi çok uzun"),
});

/** İşletme telefonu veya e-postasına karşılık gelen hesaba tek kullanımlık kod gönderir. */
export const requestVendorLoginCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => identifierSchema.parse(input))
  .handler(async ({ data }) => {
    const { findVendorUser, createServerPublicClient, maskEmail } = await import(
      "./vendor-auth.server"
    );
    const { logAudit } = await import("./audit.server");

    const vendor = await findVendorUser(data.identifier);
    if (!vendor) {
      await logAudit({
        actorId: null,
        actorEmail: null,
        action: "vendor.login.code_request",
        entity: "vendor_assignments",
        status: "denied",
        detail: { reason: "Telefon/e-postaya bağlı işletme hesabı yok" },
      });
      return {
        ok: false as const,
        error: "Bu bilgiye bağlı aktif bir işletme hesabı yok. Kurucu panelinden işletmenin iletişim bilgilerini kaydedin.",
      };
    }

    const supabase = createServerPublicClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: vendor.email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      await logAudit({
        actorId: vendor.userId,
        actorEmail: vendor.email,
        action: "vendor.login.code_request",
        entity: "vendor_assignments",
        entityId: vendor.userId,
        status: "denied",
        detail: { reason: error.message },
      });
      return {
        ok: false as const,
        error:
          "Kod e-postası şu anda gönderilemedi (e-posta servisi yanıt vermedi). Lütfen birkaç saniye sonra tekrar deneyin.",
      };
    }


    await logAudit({
      actorId: vendor.userId,
      actorEmail: vendor.email,
      action: "vendor.login.code_request",
      entity: "vendor_assignments",
      entityId: vendor.userId,
    });

    return { ok: true as const, maskedEmail: maskEmail(vendor.email) };
  });

/** Kodu doğrular ve tarayıcıda oturum kurmak için jetonları döner. */
export const verifyVendorLoginCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    identifierSchema.extend({ code: z.string().trim().max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { findVendorUser, createServerPublicClient } = await import(
      "./vendor-auth.server"
    );
    const { logAudit } = await import("./audit.server");

    const token = data.code.replace(/\D/g, "");
    if (token.length < 4) {
      return {
        ok: false as const,
        error: "Lütfen e-postanıza gelen 6 haneli kodu eksiksiz girin.",
      };
    }

    const vendor = await findVendorUser(data.identifier);
    if (!vendor) {
      return {
        ok: false as const,
        error: "Bu bilgiye bağlı aktif bir işletme hesabı yok. Kurucu panelinden işletmenin iletişim bilgilerini kaydedin.",
      };
    }

    const supabase = createServerPublicClient();
    const { data: verified, error } = await supabase.auth.verifyOtp({
      email: vendor.email,
      token,
      type: "email",
    });


    if (error || !verified.session) {
      await logAudit({
        actorId: vendor.userId,
        actorEmail: vendor.email,
        action: "vendor.login.code_verify",
        entity: "vendor_assignments",
        entityId: vendor.userId,
        status: "denied",
        detail: { reason: error?.message ?? "Oturum oluşturulamadı" },
      });
      throw new Error("Kod geçersiz veya süresi dolmuş.");
    }

    await logAudit({
      actorId: vendor.userId,
      actorEmail: vendor.email,
      action: "vendor.login.code_verify",
      entity: "vendor_assignments",
      entityId: vendor.userId,
    });

    return {
      ok: true as const,
      accessToken: verified.session.access_token,
      refreshToken: verified.session.refresh_token,
    };
  });

/** İşletme kendi şifresini mevcut şifresini doğrulayarak değiştirir. */
export const changeVendorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
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