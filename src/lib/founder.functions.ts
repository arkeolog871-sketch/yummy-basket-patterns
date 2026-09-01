import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";
import {
  isMissingColumnError,
  parseTypography,
  SITE_SETTINGS_BASE_COLUMNS,
  SITE_SETTINGS_COLUMNS_WITH_TYPOGRAPHY,
} from "./typography";
import type { Json } from "@/integrations/supabase/types";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk kodu girin");

const settingsSchema = z.object({
  brand_name: z.string().trim().min(2).max(40),
  primary_color: hexColor,
  accent_color: hexColor,
  secondary_color: hexColor,
  background_color: hexColor,
  warm_color: hexColor,
  theme_mode: z.enum(["light", "dark"]),
  layout_variant: z.enum(["classic", "compact", "spotlight"]),
});

const founderContactSchema = z.object({
  founder_contact_phone: z
    .string()
    .trim()
    .min(10, "Telefon numarası en az 10 haneli olmalı")
    .max(30)
    .regex(/^[0-9+()\s-]{10,30}$/, "Geçerli bir telefon numarası girin"),
  founder_contact_email: z
    .string()
    .trim()
    .max(160)
    .email("Geçerli bir e-posta girin")
    .transform((value) => value.toLowerCase()),
});

const heroSchema = z.object({
  hero_badge: z.string().trim().min(2).max(120),
  hero_title: z.string().trim().min(2).max(120),
  hero_title_accent: z.string().trim().max(120),
  hero_subtitle: z.string().trim().min(2).max(300),
  footer_tagline: z.string().trim().min(2).max(160),
  footer_delivery_hours: z.string().trim().min(2).max(80),
});

export const updateHeroContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => heroSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    const { logAudit } = await import("./audit.server");
    const actorEmail = (context.claims as { email?: string } | null)?.email ?? null;
    try {
      await assertFounder(context.supabase, context.userId, context.claims as never);
    } catch (error) {
      await logAudit({
        actorId: context.userId,
        actorEmail,
        action: "hero.update",
        entity: "site_settings",
        entityId: "global",
        status: "denied",
        detail: { reason: error instanceof Error ? error.message : "Sayfa yöneticisi yetkisi yok" },
      });
      throw error instanceof Error
        ? error
        : new Error("Bu işlem için sayfa yöneticisi yetkisi gerekiyor");
    }
    return audited(
      {
        actorId: context.userId,
        actorEmail,
        action: "hero.update",
        entity: "site_settings",
        entityId: "global",
        detail: { ...data },
      },
      async () => {
        const { error } = await context.supabase
          .from("site_settings")
          .update(data)
          .eq("id", "global");
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const updateFounderContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => founderContactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "founder_contact.update",
        entity: "site_settings",
        entityId: "global",
        detail: { ...data },
      },
      async () => {
        const { error } = await context.supabase
          .from("site_settings")
          .update(data)
          .eq("id", "global");
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

const adminMessageSchema = z
  .object({
    target_type: z.enum(["all", "customers", "vendors", "restaurant"]),
    restaurant_id: z.string().uuid().nullable().default(null),
    title: z.string().trim().min(2).max(120),
    body: z.string().trim().min(2).max(1000),
  })
  .refine((data) => data.target_type !== "restaurant" || Boolean(data.restaurant_id), {
    message: "Belirli bir işletme seçmelisiniz",
    path: ["restaurant_id"],
  });

export const sendAdminMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => adminMessageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    const restaurantId = data.target_type === "restaurant" ? data.restaurant_id : null;
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "message.send",
        entity: "admin_messages",
        detail: { target_type: data.target_type, restaurant_id: restaurantId, title: data.title },
      },
      async () => {
        const { error } = await context.supabase.from("admin_messages").insert({
          sender_id: context.userId,
          target_type: data.target_type,
          restaurant_id: restaurantId,
          title: data.title,
          body: data.body,
        });
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const listAdminMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      const { data, error } = await context.supabase
        .from("admin_messages")
        .select("id, target_type, restaurant_id, title, body, created_at, restaurants(name)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  );

const businessSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Sadece küçük harf, rakam ve tire"),
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160).nullable().default(null),
  category: z.string().trim().min(2).max(40),
  sector: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Sadece küçük harf, rakam ve tire")
    .default("yemek"),
  cuisines: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  delivery_minutes: z.number().int().min(0).max(600),
  delivery_fee: z.number().min(0).max(10000),
  min_order: z.number().min(0).max(100000),
  cover_image_url: z.string().trim().max(500).nullable().default(null),
  address: z.string().trim().max(240).nullable().default(null),
  district: z.string().trim().max(80).nullable().default(null),
  city: z.string().trim().max(80).nullable().default(null),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  maps_url: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || /^https?:\/\//i.test(value), "Geçerli bir bağlantı girin")
    .nullable()
    .default(null),
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
  is_active: z.boolean().default(true),
});

const timeField = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Saati SS:DD biçiminde girin")
  .nullable()
  .default(null);

const businessHoursFields = {
  opens_at: timeField,
  closes_at: timeField,
  is_open_manual: z.boolean().default(true),
};

const businessWithHoursSchema = businessSchema.extend(businessHoursFields);

const menuCategorySchema = z.object({
  id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
  position: z.number().int().min(0).max(999).default(0),
});

const menuItemSchema = z.object({
  id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().default(null),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).nullable().default(null),
  price: z.number().min(0).max(100000),
  image_url: z.string().trim().max(500).nullable().default(null),
  is_popular: z.boolean().default(false),
  is_available: z.boolean().default(true),
});

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicClient } = await import("./catalog.server");
  const supabase = createPublicClient();
  const withTypography = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_COLUMNS_WITH_TYPOGRAPHY)
    .eq("id", "global")
    .maybeSingle();
  if (withTypography.error && isMissingColumnError(withTypography.error, "typography")) {
    const fallback = await supabase
      .from("site_settings")
      .select(SITE_SETTINGS_BASE_COLUMNS)
      .eq("id", "global")
      .maybeSingle();
    if (fallback.error) {
      console.error("[getSiteSettings]", fallback.error.message);
      return null;
    }
    return fallback.data;
  }
  if (withTypography.error) {
    console.error("[getSiteSettings]", withTypography.error.message);
    return null;
  }
  return withTypography.data;
});

export const getFounderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isFounderUser } = await import("./founder.server");
    const isFounder = await isFounderUser(context.supabase, context.userId);
    const { count, error } = await context.supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "founder");
    if (error) throw new Error(error.message);
    return { isFounder, founderExists: (count ?? 0) > 0 || isFounder };
  });

export const claimFounder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertVerifiedEmail } = await import("./otp.server");
    await assertVerifiedEmail(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");
    const actorEmail = (context.claims as { email?: string } | null)?.email ?? null;
    const allowedBootstrapEmails = (process.env["FOUNDER_BOOTSTRAP_EMAILS"] ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (!actorEmail || !allowedBootstrapEmails.includes(actorEmail.trim().toLowerCase())) {
      await logAudit({
        actorId: context.userId,
        actorEmail,
        action: "founder.claim",
        entity: "user_roles",
        status: "denied",
        detail: { reason: "Sayfa yöneticisi bootstrap allowlist dışında" },
      });
      throw new Error(
        "Sayfa yöneticisi hesabı deployment yöneticisi tarafından yetkilendirilmelidir.",
      );
    }
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "founder");
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) {
      await logAudit({
        actorId: context.userId,
        actorEmail,
        action: "founder.claim",
        entity: "user_roles",
        status: "denied",
        detail: { reason: "Sayfa yöneticisi profili zaten tanımlı" },
      });
      throw new Error("Sayfa yöneticisi profili zaten tanımlı");
    }

    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "founder" });
    if (insertError) throw new Error(insertError.message);
    await logAudit({
      actorId: context.userId,
      actorEmail,
      action: "founder.claim",
      entity: "user_roles",
      entityId: context.userId,
    });
    return { ok: true };
  });

export const updateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "settings.update",
        entity: "site_settings",
        entityId: "global",
        detail: { ...data },
      },
      async () => {
        const { error } = await context.supabase
          .from("site_settings")
          .update(data)
          .eq("id", "global");
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const updateTypography = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => parseTypography(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "typography.update",
        entity: "site_settings",
        entityId: "global",
        detail: { scaleRatio: data.scaleRatio, fontFamily: data.fontFamily },
      },
      async () => {
        const { error } = await context.supabase
          .from("site_settings")
          .update({ typography: data as unknown as Json })
          .eq("id", "global");
        if (error) {
          if (isMissingColumnError(error, "typography")) {
            throw new Error(
              "Tipografi sütunu henüz yok. Lütfen site_settings şema güncellemesini uygulayın.",
            );
          }
          throw new Error(error.message);
        }
        return { ok: true };
      },
    );
  });

export const listAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      // Kurucu doğrulandıktan sonra iletişim alanlarını da okuyabilmek için yetkili istemci.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // İşletme sayısı yüzlerle ifade edilse bile (300+) tek sorguda kalabilecek
      // cömert bir üst sınır. Menü kategorileri/ürünleri artık burada tüm
      // kataloğu çekmiyor — her işletmenin binlerce ürünü olabileceğinden
      // listBusinessCatalog ile tek işletme seçildiğinde ayrıca çekiliyor.
      const CATALOG_LIMIT = 1000;
      const [businesses, orders] = await Promise.all([
        supabaseAdmin.from("restaurants").select("*").order("name").limit(CATALOG_LIMIT),
        context.supabase
          .from("orders")
          .select(
            "id, status, payment_status, total, recipient_name, phone, street, district, city, created_at, restaurants(name)",
          )
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const firstError = businesses.error ?? orders.error ?? null;
      if (firstError) throw new Error(firstError.message);

      return {
        businesses: businesses.data ?? [],
        orders: orders.data ?? [],
      };
    }),
  );

/**
 * Tek bir işletmenin menü kategorilerini ve ürünlerini döner. Kurucu paneli
 * kategori/ürün sekmelerinde tüm kataloğu değil, seçilen işletmenin
 * kataloğunu çeker — işletme sayısı ve ürün sayısı ne kadar büyürse büyüsün
 * (300+ işletme, işletme başına binlerce ürün) payload her zaman tek
 * işletmenin boyutuyla sınırlı kalır.
 */
export const listBusinessCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      // Ürünler için: müşteri tarafı is_available=true dışını göremez, kurucunun
      // satışta olmayan ürünleri de düzenleyebilmesi için yetkili istemci gerekli.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [categories, items] = await Promise.all([
        context.supabase
          .from("menu_categories")
          .select("*")
          .eq("restaurant_id", data.restaurantId)
          .order("position")
          .limit(1000),
        supabaseAdmin
          .from("menu_items")
          .select("*")
          .eq("restaurant_id", data.restaurantId)
          .order("name")
          .limit(2000),
      ]);

      const firstError = categories.error ?? items.error ?? null;
      if (firstError) throw new Error(firstError.message);

      return {
        categories: categories.data ?? [],
        items: items.data ?? [],
      };
    }),
  );

export const saveBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => businessWithHoursSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder, ensureBusinessVendorAccount } = await import("./founder.server");
      const { audited } = await import("./audit.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      const { id, ...values } = data;
      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: id ? "business.update" : "business.create",
          entity: "restaurants",
          entityId: id ?? null,
          detail: { name: values.name, slug: values.slug, category: values.category },
        },
        async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const businessId = id ?? crypto.randomUUID();
          const createdBusiness = !id;
          const { error } = id
            ? await supabaseAdmin.from("restaurants").update(values).eq("id", id)
            : await supabaseAdmin.from("restaurants").insert({
                ...values,
                id: businessId,
                is_active: false,
              });
          if (error) throw new Error(error.message);
          try {
            const vendor = await ensureBusinessVendorAccount({
              restaurantId: businessId,
              businessName: values.name,
              email: values.contact_email,
              phone: values.contact_phone,
            });
            if (!vendor.emailVerified) {
              const { error: inactiveError } = await supabaseAdmin
                .from("restaurants")
                .update({ is_active: false })
                .eq("id", businessId);
              if (inactiveError) throw new Error(inactiveError.message);
            } else if (createdBusiness) {
              const { error: activeError } = await supabaseAdmin
                .from("restaurants")
                .update({ is_active: values.is_active })
                .eq("id", businessId);
              if (activeError) throw new Error(activeError.message);
            }
            return {
              ok: true,
              vendorLinked: true,
              verificationSent: vendor.verificationSent,
              emailVerified: vendor.emailVerified,
            };
          } catch (error) {
            if (createdBusiness) {
              await supabaseAdmin.from("restaurants").delete().eq("id", businessId);
            }
            throw error;
          }
        },
      );
    }),
  );

export const deleteBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "business.delete",
        entity: "restaurants",
        entityId: data.id,
      },
      async () => {
        const { error } = await context.supabase.from("restaurants").delete().eq("id", data.id);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

/** Kurucu, gelen siparişin durumunu anlık olarak değiştirir. */
export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum([
          "pending",
          "confirmed",
          "preparing",
          "on_the_way",
          "delivered",
          "cancelled",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      const { audited } = await import("./audit.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "order.status",
          entity: "orders",
          entityId: data.id,
          detail: { status: data.status },
        },
        async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: updated, error } = await supabaseAdmin
            .from("orders")
            .update({ status: data.status })
            .eq("id", data.id)
            .select("id, user_id, restaurants(name)")
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (updated) {
            const { notifyCustomerOfOrderStatus } = await import("./order-customer-alert.server");
            await notifyCustomerOfOrderStatus(updated, data.status);
          }
          return { ok: true };
        },
      );
    }),
  );

export const saveMenuCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => menuCategorySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    const { id, ...values } = data;
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: id ? "menu_category.update" : "menu_category.create",
        entity: "menu_categories",
        entityId: id ?? null,
        detail: { name: values.name, restaurant_id: values.restaurant_id },
      },
      async () => {
        const { error } = id
          ? await context.supabase.from("menu_categories").update(values).eq("id", id)
          : await context.supabase.from("menu_categories").insert(values);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const deleteMenuCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "menu_category.delete",
        entity: "menu_categories",
        entityId: data.id,
      },
      async () => {
        const { error } = await context.supabase.from("menu_categories").delete().eq("id", data.id);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const saveMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => menuItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    const { id, ...values } = data;
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: id ? "menu_item.update" : "menu_item.create",
        entity: "menu_items",
        entityId: id ?? null,
        detail: { name: values.name, price: values.price, restaurant_id: values.restaurant_id },
      },
      async () => {
        const { error } = id
          ? await context.supabase.from("menu_items").update(values).eq("id", id)
          : await context.supabase.from("menu_items").insert(values);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "menu_item.delete",
        entity: "menu_items",
        entityId: data.id,
      },
      async () => {
        const { error } = await context.supabase.from("menu_items").delete().eq("id", data.id);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertFounder } = await import("./founder.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesError) throw new Error(rolesError.message);

    const { data: assignments, error: assignError } = await supabaseAdmin
      .from("vendor_assignments")
      .select("user_id, restaurant_id");
    if (assignError) throw new Error(assignError.message);

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, phone");
    if (profilesError) throw new Error(profilesError.message);

    const phoneByUser = new Map((profiles ?? []).map((row) => [row.id, row.phone]));
    const rolesByUser = new Map<string, string[]>();
    for (const row of roles ?? []) {
      const bucket = rolesByUser.get(row.user_id);
      if (bucket) bucket.push(row.role);
      else rolesByUser.set(row.user_id, [row.role]);
    }
    const restaurantIdByUser = new Map<string, string>();
    for (const row of assignments ?? []) {
      if (!restaurantIdByUser.has(row.user_id))
        restaurantIdByUser.set(row.user_id, row.restaurant_id);
    }

    return list.users.map((user) => ({
      id: user.id,
      email: user.email ?? "—",
      phone: phoneByUser.get(user.id) ?? null,
      created_at: user.created_at,
      roles: rolesByUser.get(user.id) ?? [],
      vendorRestaurantId: restaurantIdByUser.get(user.id) ?? null,
    }));
  });

/** Kurucu, bir kullanıcıyı tek bir işletmeye atar veya atamasını kaldırır. */
export const setVendorAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        restaurantId: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: data.restaurantId ? "vendor.assign" : "vendor.unassign",
        entity: "vendor_assignments",
        entityId: data.userId,
        detail: { restaurant_id: data.restaurantId },
      },
      async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (!data.restaurantId) {
          const { error } = await supabaseAdmin
            .from("vendor_assignments")
            .delete()
            .eq("user_id", data.userId);
          if (error) throw new Error(error.message);
          await supabaseAdmin
            .from("user_roles")
            .delete()
            .eq("user_id", data.userId)
            .eq("role", "vendor");
          return { ok: true };
        }

        const { error } = await supabaseAdmin
          .from("vendor_assignments")
          .upsert(
            { user_id: data.userId, restaurant_id: data.restaurantId },
            { onConflict: "user_id" },
          );
        if (error) throw new Error(error.message);
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: data.userId, role: "vendor" }, { onConflict: "user_id,role" });
        if (roleError) throw new Error(roleError.message);
        return { ok: true };
      },
    );
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "user", "founder", "vendor"]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    if (data.role === "founder" && !data.grant && data.userId === context.userId) {
      throw new Error("Kendi sayfa yöneticisi yetkinizi kaldıramazsınız");
    }

    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: data.grant ? "role.grant" : "role.revoke",
        entity: "user_roles",
        entityId: data.userId,
        detail: { role: data.role },
      },
      async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = data.grant
          ? await supabaseAdmin
              .from("user_roles")
              .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" })
          : await supabaseAdmin
              .from("user_roles")
              .delete()
              .eq("user_id", data.userId)
              .eq("role", data.role);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

/** Kurucu, yeni bir yetkili hesap oluşturur ve seçilen rolü atar. */
export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(200),
        password: z.string().min(8).max(72),
        phone: z
          .string()
          .trim()
          .min(10, "Telefon numarası en az 10 haneli olmalı")
          .max(20)
          .regex(/^[0-9+()\s-]+$/, "Telefon numarası geçersiz"),
        fullName: z.string().trim().max(120).optional(),
        role: z.enum(["admin", "founder", "user", "vendor"]),
        verifyEmail: z.boolean().optional().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "user.create",
        entity: "auth.users",
        detail: { email: data.email, role: data.role, verifyEmail: data.verifyEmail },
      },
      async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { normalizePhone } = await import("./vendor-auth.server");
        const phone = normalizePhone(data.phone);
        if (phone.length < 10) throw new Error("Telefon numarası en az 10 haneli olmalı");

        const { data: existing, error: existingError } = await supabaseAdmin
          .from("profiles")
          .select("id, phone")
          .not("phone", "is", null);
        if (existingError) throw new Error(existingError.message);
        if ((existing ?? []).some((row) => row.phone && normalizePhone(row.phone) === phone)) {
          throw new Error("Bu telefon numarası başka bir hesapta kayıtlı");
        }

        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: data.password,
          email_confirm: !data.verifyEmail,
          user_metadata: { full_name: data.fullName ?? "", phone },
        });
        if (error) throw new Error(error.message);
        const newId = created.user?.id;
        if (!newId) throw new Error("Kullanıcı oluşturulamadı");

        try {
          const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .upsert(
              { id: newId, phone, full_name: data.fullName?.trim() || null },
              { onConflict: "id" },
            );
          if (profileError) throw new Error(profileError.message);

          const { error: roleError } = await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: newId, role: data.role }, { onConflict: "user_id,role" });
          if (roleError) throw new Error(roleError.message);

          let verificationSent = false;
          if (data.verifyEmail) {
            const { sendSixDigitOtp, hashEmail, EMAIL_SEND_FAILED_MESSAGE, clearGuard } =
              await import("./otp.server");
            const sent = await sendSixDigitOtp(data.email, "signup");
            if (!sent.ok) {
              console.error("[staff-signup] doğrulama e-postası gönderilemedi", {
                emailHash: hashEmail(data.email),
                role: data.role,
                message: sent.error,
              });
              await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
              await supabaseAdmin.from("profiles").delete().eq("id", newId);
              await supabaseAdmin.auth.admin.deleteUser(newId);
              await clearGuard(data.email);
              throw new Error(EMAIL_SEND_FAILED_MESSAGE);
            }
            verificationSent = true;
          }
          return { ok: true, userId: newId, verificationSent };
        } catch (error) {
          if (error instanceof Error && error.message.includes("Doğrulama e-postası")) throw error;
          await supabaseAdmin.auth.admin.deleteUser(newId).catch(() => undefined);
          throw error;
        }
      },
    );
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    if (data.userId === context.userId) throw new Error("Kendi hesabınızı silemezsiniz");

    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "user.delete",
        entity: "auth.users",
        entityId: data.userId,
      },
      async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });
