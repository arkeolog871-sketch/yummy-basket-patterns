import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

/**
 * Başvuru formunda kurucu panelindeki işletme alanlarının TÜMÜ zorunludur:
 * kurucu incelemesi eksik bilgiyle yapılmasın diye nullable alanlar da istenir.
 */
const applicationSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Sadece küçük harf, rakam ve tire"),
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().min(2, "Kısa tanıtım girin").max(160),
  category: z.string().trim().min(2, "Alt tür girin").max(40),
  sector: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Sadece küçük harf, rakam ve tire"),
  cuisines: z.array(z.string().trim().min(1).max(30)).min(1, "En az bir etiket girin").max(8),
  delivery_minutes: z.number().int().min(0).max(600),
  delivery_fee: z.number().min(0).max(10000),
  min_order: z.number().min(0).max(100000),
  cover_image_url: z
    .string()
    .trim()
    .min(4, "Görsel adresi girin")
    .max(500)
    .refine((value) => /^https?:\/\//i.test(value), "Geçerli bir görsel bağlantısı girin"),
  address: z.string().trim().min(5, "Açık adres girin").max(240),
  district: z.string().trim().min(2, "İlçe girin").max(80),
  city: z.string().trim().min(2, "Şehir girin").max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  maps_url: z
    .string()
    .trim()
    .min(4, "Harita bağlantısı girin")
    .max(500)
    .refine((value) => /^https?:\/\//i.test(value), "Geçerli bir bağlantı girin"),
  contact_email: z
    .string()
    .trim()
    .max(160)
    .email("Geçerli bir e-posta girin")
    .transform((value) => value.toLowerCase()),
  contact_phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+()\s-]{10,30}$/, "Geçerli bir telefon numarası girin"),
  contact_person: z.string().trim().min(2, "Yetkili ad soyad girin").max(120),
  opens_at: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Açılış saatini SS:DD biçiminde girin"),
  closes_at: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Kapanış saatini SS:DD biçiminde girin"),
  is_open_manual: z.boolean(),
});

const APPLICATION_COLUMNS =
  "id, applicant_user_id, status, founder_note, reviewed_at, created_at, slug, name, tagline, category, sector, cuisines, delivery_minutes, delivery_fee, min_order, cover_image_url, address, district, city, latitude, longitude, maps_url, contact_email, contact_phone, contact_person, opens_at, closes_at, is_open_manual";

/** Giriş yapmış kullanıcı kendi işletme başvurusunu oluşturur. */
export const submitBusinessApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => applicationSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertVerifiedEmail } = await import("./otp.server");
      await assertVerifiedEmail(context.userId);

      const { data: pending, error: pendingError } = await context.supabase
        .from("business_applications")
        .select("id")
        .eq("applicant_user_id", context.userId)
        .eq("status", "pending")
        .limit(1);
      if (pendingError) throw new Error(pendingError.message);
      if ((pending ?? []).length > 0) {
        throw new Error("Bekleyen bir başvurunuz var; sonuçlanmasını bekleyin.");
      }

      const { error } = await context.supabase.from("business_applications").insert({
        ...data,
        applicant_user_id: context.userId,
        status: "pending",
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );

/** Başvuru sahibinin kendi başvuru geçmişi. */
export const listMyBusinessApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { data, error } = await context.supabase
        .from("business_applications")
        .select(APPLICATION_COLUMNS)
        .eq("applicant_user_id", context.userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  );

/** Kurucu tüm başvuruları görür. */
export const listBusinessApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      const { data, error } = await context.supabase
        .from("business_applications")
        .select(APPLICATION_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  );

/** Kurucu başvuruyu onaylar (gerçek işletme + vendor hesabı) veya reddeder. */
export const reviewBusinessApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
        note: z.string().trim().max(500).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder, ensureBusinessVendorAccount } = await import("./founder.server");
      const { audited } = await import("./audit.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: application, error: readError } = await supabaseAdmin
        .from("business_applications")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!application) throw new Error("Başvuru bulunamadı");
      if (application.status !== "pending") throw new Error("Bu başvuru zaten sonuçlandırılmış");

      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: data.action === "approve" ? "application.approve" : "application.reject",
          entity: "business_applications",
          entityId: data.id,
          detail: { name: application.name, slug: application.slug },
        },
        async () => {
          const { notifyApplicantOfApplicationReview } = await import(
            "./business-application-alert.server"
          );

          if (data.action === "reject") {
            const { error } = await supabaseAdmin
              .from("business_applications")
              .update({
                status: "rejected",
                founder_note: data.note,
                reviewed_by: context.userId,
                reviewed_at: new Date().toISOString(),
              })
              .eq("id", data.id);
            if (error) throw new Error(error.message);
            await notifyApplicantOfApplicationReview({
              applicantUserId: application.applicant_user_id,
              businessName: application.name,
              approved: false,
              founderNote: data.note,
            });
            return { ok: true, approved: false as const };
          }

          const businessId = crypto.randomUUID();
          const { error: insertError } = await supabaseAdmin.from("restaurants").insert({
            id: businessId,
            slug: application.slug,
            name: application.name,
            tagline: application.tagline,
            category: application.category,
            sector: application.sector,
            cuisines: application.cuisines,
            delivery_minutes: application.delivery_minutes,
            delivery_fee: application.delivery_fee,
            min_order: application.min_order,
            cover_image_url: application.cover_image_url,
            address: application.address,
            district: application.district,
            city: application.city,
            latitude: application.latitude,
            longitude: application.longitude,
            maps_url: application.maps_url,
            contact_email: application.contact_email,
            contact_phone: application.contact_phone,
            contact_person: application.contact_person,
            opens_at: application.opens_at,
            closes_at: application.closes_at,
            is_open_manual: application.is_open_manual,
            // Vendor hesabı e-postasını doğrulayana kadar vitrinde görünmez.
            is_active: false,
          });
          if (insertError) throw new Error(insertError.message);

          try {
            const vendor = await ensureBusinessVendorAccount({
              restaurantId: businessId,
              businessName: application.name,
              ownerName: application.contact_person,
              email: application.contact_email,
              phone: application.contact_phone,
            });

            if (vendor.emailVerified) {
              const { error: activeError } = await supabaseAdmin
                .from("restaurants")
                .update({ is_active: true })
                .eq("id", businessId);
              if (activeError) throw new Error(activeError.message);
            }

            const { error: statusError } = await supabaseAdmin
              .from("business_applications")
              .update({
                status: "approved",
                founder_note: data.note,
                reviewed_by: context.userId,
                reviewed_at: new Date().toISOString(),
              })
              .eq("id", data.id);
            if (statusError) throw new Error(statusError.message);

            await notifyApplicantOfApplicationReview({
              applicantUserId: application.applicant_user_id,
              businessName: application.name,
              approved: true,
              contactEmail: application.contact_email,
            });

            return {
              ok: true,
              approved: true as const,
              restaurantId: businessId,
              verificationSent: vendor.verificationSent,
              emailVerified: vendor.emailVerified,
            };
          } catch (error) {
            // Vendor hesabı açılamazsa yeni eklenen işletme satırı sahipsiz kalmasın.
            await supabaseAdmin.from("restaurants").delete().eq("id", businessId);
            throw error;
          }
        },

      );
    }),
  );
