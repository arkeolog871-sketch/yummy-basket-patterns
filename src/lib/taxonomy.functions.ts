import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Sadece küçük harf, rakam ve tire"),
  label: z.string().trim().min(2).max(40),
  icon: z.string().trim().min(2).max(40),
  position: z.number().int().min(0).max(999),
  is_active: z.boolean(),
});

const areaSchema = z.object({
  id: z.string().uuid().optional(),
  city: z.string().trim().min(2).max(60),
  district: z.string().trim().min(2).max(60),
  position: z.number().int().min(0).max(999),
  is_active: z.boolean(),
});

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => categorySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    const { id, ...values } = data;
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: id ? "category.update" : "category.create",
        entity: "app_categories",
        entityId: id ?? null,
        detail: { slug: values.slug, label: values.label },
      },
      async () => {
        const { error } = id
          ? await context.supabase.from("app_categories").update(values).eq("id", id)
          : await context.supabase.from("app_categories").insert(values);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const deleteCategory = createServerFn({ method: "POST" })
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
        action: "category.delete",
        entity: "app_categories",
        entityId: data.id,
      },
      async () => {
        const { error } = await context.supabase
          .from("app_categories")
          .delete()
          .eq("id", data.id);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const moveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { logAudit } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    const { data: rows, error } = await context.supabase
      .from("app_categories")
      .select("id, position")
      .order("position");
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const index = list.findIndex((row) => row.id === data.id);
    const swapIndex = data.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= list.length) return { ok: true };

    const current = list[index]!;
    const target = list[swapIndex]!;
    const [a, b] = await Promise.all([
      context.supabase
        .from("app_categories")
        .update({ position: target.position })
        .eq("id", current.id),
      context.supabase
        .from("app_categories")
        .update({ position: current.position })
        .eq("id", target.id),
    ]);
    const failure = a.error ?? b.error;
    if (failure) throw new Error(failure.message);

    await logAudit({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
      action: "category.reorder",
      entity: "app_categories",
      entityId: data.id,
      detail: { direction: data.direction },
    });
    return { ok: true };
  });

export const saveServiceArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => areaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    const { id, ...values } = data;
    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: id ? "service_area.update" : "service_area.create",
        entity: "service_areas",
        entityId: id ?? null,
        detail: { city: values.city, district: values.district },
      },
      async () => {
        const { error } = id
          ? await context.supabase.from("service_areas").update(values).eq("id", id)
          : await context.supabase.from("service_areas").insert(values);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });

export const deleteServiceArea = createServerFn({ method: "POST" })
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
        action: "service_area.delete",
        entity: "service_areas",
        entityId: data.id,
      },
      async () => {
        const { error } = await context.supabase
          .from("service_areas")
          .delete()
          .eq("id", data.id);
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });