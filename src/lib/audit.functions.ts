import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const loginAttemptSchema = z.object({
  email: z.string().trim().email().max(200),
  status: z.enum(["success", "error", "denied"]),
  reason: z.string().trim().max(200).optional(),
  userId: z.string().uuid().optional(),
});

const listSchema = z.object({
  limit: z.number().int().min(1).max(500).default(200),
  action: z.string().trim().max(60).optional(),
  status: z.enum(["all", "success", "error", "denied"]).default("all"),
});

/** Kurucu giriş denemelerini kaydeder (giriş başarısız olabileceği için kimlik doğrulaması gerekmez). */
export const logFounderLoginAttempt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => loginAttemptSchema.parse(input))
  .handler(async ({ data }) => {
    const { logAudit } = await import("./audit.server");
    await logAudit({
      actorId: data.userId ?? null,
      actorEmail: data.email,
      action: "founder.login",
      entity: "auth",
      status: data.status,
      detail: data.reason ? { reason: data.reason } : {},
    });
    return { ok: true };
  });

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    let query = context.supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.action) query = query.eq("action", data.action);
    if (data.status !== "all") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });