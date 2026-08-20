import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk kodu girin");

const settingsSchema = z.object({
  brand_name: z.string().trim().min(2).max(40),
  primary_color: hexColor,
  accent_color: hexColor,
  theme_mode: z.enum(["light", "dark"]),
  layout_variant: z.enum(["classic", "compact", "spotlight"]),
});

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
  cuisines: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  delivery_minutes: z.number().int().min(0).max(600),
  delivery_fee: z.number().min(0).max(10000),
  min_order: z.number().min(0).max(100000),
  cover_image_url: z.string().trim().max(500).nullable().default(null),
  is_active: z.boolean().default(true),
});

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
  const { data, error } = await supabase.from("site_settings").select("*").eq("id", "global").maybeSingle();
  if (error) throw new Error(error.message);
  return data;
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");
    const actorEmail = (context.claims as { email?: string } | null)?.email ?? null;
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
        detail: { reason: "Kurucu profili zaten tanımlı" },
      });
      throw new Error("Kurucu profili zaten tanımlı");
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
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId);
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

export const listAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertFounder } = await import("./founder.server");
    await assertFounder(context.supabase, context.userId);

    const [businesses, categories, items, orders] = await Promise.all([
      context.supabase.from("restaurants").select("*").order("name"),
      context.supabase.from("menu_categories").select("*").order("position"),
      context.supabase.from("menu_items").select("*").order("name"),
      context.supabase
        .from("orders")
        .select("id, status, total, recipient_name, city, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const firstError =
      businesses.error ?? categories.error ?? items.error ?? orders.error ?? null;
    if (firstError) throw new Error(firstError.message);

    return {
      businesses: businesses.data ?? [],
      categories: categories.data ?? [],
      items: items.data ?? [],
      orders: orders.data ?? [],
    };
  });

export const saveBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId);
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
        const { error } = id
          ? await context.supabase.from("restaurants").update(values).eq("id", id)
          : await context.supabase.from("restaurants").insert(values);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const deleteBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId);
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

export const saveMenuCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => menuCategorySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId);
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
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId);
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
  .inputValidator((input: unknown) => menuItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId);
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
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId);
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
    await assertFounder(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesError) throw new Error(rolesError.message);

    return list.users.map((user) => ({
      id: user.id,
      email: user.email ?? "—",
      created_at: user.created_at,
      roles: (roles ?? []).filter((row) => row.user_id === user.id).map((row) => row.role),
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "user", "founder"]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId);

    if (data.role === "founder" && !data.grant && data.userId === context.userId) {
      throw new Error("Kendi kurucu yetkinizi kaldıramazsınız");
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
        const { error } = data.grant
          ? await context.supabase
              .from("user_roles")
              .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" })
          : await context.supabase
              .from("user_roles")
              .delete()
              .eq("user_id", data.userId)
              .eq("role", data.role);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId);
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