import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

const profileSchema = z.object({
  full_name: z.string().trim().max(120).nullable(),
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

/** Ad ve telefonu günceller. Telefon değişirse doğrulama durumu sıfırlanır. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { data: current } = await context.supabase
        .from("profiles")
        .select("phone")
        .eq("id", context.userId)
        .maybeSingle();
      const phoneChanged = current?.phone !== data.phone;

      const { error } = await context.supabase.from("profiles").upsert(
        {
          id: context.userId,
          full_name: data.full_name,
          phone: data.phone,
          ...(phoneChanged ? { phone_verified: false } : {}),
        },
        { onConflict: "id" },
      );
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );
