import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkFullName } from "@/lib/name-validation";
import { runServerFn } from "./public-error";

const profileSchema = z.object({
  // Boş/null bırakmaya izin verilir (kullanıcı adını silebilir — bir sonraki
  // girişte zorunlu tamamlama adımı yeniden karşısına çıkar); ama bir değer
  // GİRİLİYORSA argo/gerçek dışı isim reddedilir.
  full_name: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .superRefine((value, ctx) => {
      if (!value) return;
      const result = checkFullName(value);
      if (!result.ok) ctx.addIssue({ code: "custom", message: result.reason });
    }),
  phone: z
    .string()
    .trim()
    .min(10, "Telefon numarası en az 10 haneli olmalı")
    .max(30)
    .regex(/^[0-9+()\s-]{10,30}$/, "Geçerli bir telefon numarası girin"),
});

/** Müşterinin kendi profili: ad, telefon ve e-posta/telefon doğrulama durumu. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { isEmailVerified } = await import("./otp.server");
      const [profile, emailVerified] = await Promise.all([
        context.supabase
          .from("profiles")
          .select("full_name, phone, phone_verified")
          .eq("id", context.userId)
          .maybeSingle(),
        isEmailVerified(context.userId),
      ]);
      if (profile.error) throw new Error(profile.error.message);
      return {
        full_name: profile.data?.full_name ?? null,
        phone: profile.data?.phone ?? null,
        phone_verified: profile.data?.phone_verified ?? false,
        email: (context.claims as { email?: string } | null)?.email ?? null,
        email_verified: emailVerified,
      };
    }),
  );

export const fullNameSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Ad soyad girin")
    .max(120)
    .superRefine((value, ctx) => {
      const result = checkFullName(value);
      if (!result.ok) ctx.addIssue({ code: "custom", message: result.reason });
    }),
});

/**
 * Kayıt sonrası zorunlu ad-soyad tamamlama adımı için: yalnızca `full_name`
 * yazar, telefonu etkilemez. `updateMyProfile` telefon olmadan kaydetmeye
 * izin vermiyor (bkz. şema) — ad soyadın kendi başına, telefon beklemeden
 * kaydedilebilmesi için ayrı bir fonksiyon.
 */
export const completeFullName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => fullNameSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { error } = await context.supabase
        .from("profiles")
        .upsert({ id: context.userId, full_name: data.full_name }, { onConflict: "id" });
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );

/** Ad ve telefonu günceller. Telefon değişirse doğrulama durumu sıfırlanır. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      // Telefon değişince doğrulama durumunu veritabanı tetikleyicisi sıfırlar.
      const { error } = await context.supabase.from("profiles").upsert(
        {
          id: context.userId,
          full_name: data.full_name,
          phone: data.phone,
        },
        { onConflict: "id" },
      );
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );
