import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(10, "Telefon numarasını eksiksiz girin")
    .max(20, "Telefon numarası çok uzun"),
});

/** İşletme telefonuna karşılık gelen hesabın e-postasına tek kullanımlık kod gönderir. */
export const requestVendorLoginCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => phoneSchema.parse(input))
  .handler(async ({ data }) => {
    const { findVendorUserByPhone, createServerPublicClient, maskEmail } = await import(
      "./vendor-auth.server"
    );
    const { logAudit } = await import("./audit.server");

    const vendor = await findVendorUserByPhone(data.phone);
    if (!vendor) {
      await logAudit({
        actorId: null,
        actorEmail: null,
        action: "vendor.login.code_request",
        entity: "vendor_assignments",
        status: "denied",
        detail: { reason: "Telefon numarasına bağlı işletme hesabı yok" },
      });
      throw new Error("Bu telefon numarasına bağlı bir işletme hesabı bulunamadı.");
    }

    const supabase = createServerPublicClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: vendor.email,
      options: { shouldCreateUser: false },
    });
    if (error) throw new Error(error.message);

    await logAudit({
      actorId: vendor.userId,
      actorEmail: vendor.email,
      action: "vendor.login.code_request",
      entity: "vendor_assignments",
      entityId: vendor.userId,
    });

    return { maskedEmail: maskEmail(vendor.email) };
  });

/** Kodu doğrular ve tarayıcıda oturum kurmak için jetonları döner. */
export const verifyVendorLoginCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    phoneSchema.extend({ code: z.string().trim().min(4).max(10) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { findVendorUserByPhone, createServerPublicClient } = await import(
      "./vendor-auth.server"
    );
    const { logAudit } = await import("./audit.server");

    const vendor = await findVendorUserByPhone(data.phone);
    if (!vendor) throw new Error("Bu telefon numarasına bağlı bir işletme hesabı bulunamadı.");

    const supabase = createServerPublicClient();
    const { data: verified, error } = await supabase.auth.verifyOtp({
      email: vendor.email,
      token: data.code.replace(/\s/g, ""),
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