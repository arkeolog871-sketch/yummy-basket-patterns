import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const reportSchema = z.object({
  message: z.string().trim().min(1).max(1_000),
  stack: z.string().trim().max(8_000).optional(),
  path: z.string().trim().max(300).optional(),
});

const listSchema = z.object({
  limit: z.number().int().min(1).max(300).default(150),
  status: z.enum(["all", "open", "resolved"]).default("open"),
});

const idSchema = z.object({ id: z.string().uuid() });

/** İstemcide oluşan çalışma zamanı hatalarını kaydeder (giriş gerekmez, hız sınırlıdır). */
export const reportAppError = createServerFn({ method: "POST" })
  .validator((input: unknown) => reportSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
      enforceSensitiveRateLimit("app-error-report", 20, 5 * 60 * 1000);
      const { recordAppError } = await import("./errors.server");
      await recordAppError({
        source: "client",
        message: data.message,
        stack: data.stack ?? null,
        path: data.path ?? null,
      });
    } catch {
      // Hata kaydı başarısız olsa da kullanıcı akışını bozmuyoruz.
    }
    return { ok: true };
  });

export const listAppErrors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    let query = context.supabase
      .from("app_errors")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(data.limit);

    if (data.status === "open") query = query.eq("resolved", false);
    if (data.status === "resolved") query = query.eq("resolved", true);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const resolveAppError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.extend({ resolved: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    const { error } = await context.supabase
      .from("app_errors")
      .update({ resolved: data.resolved })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAppError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    const { error } = await context.supabase.from("app_errors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
