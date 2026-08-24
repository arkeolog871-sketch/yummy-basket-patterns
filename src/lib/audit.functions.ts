import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const loginAttemptSchema = z.object({
  email: z.string().trim().email().max(200),
  status: z.enum(["success", "error", "denied"]),
  reason: z.string().trim().max(200).optional(),
});

const listSchema = z.object({
  limit: z.number().int().min(1).max(500).default(200),
  action: z.string().trim().max(60).optional(),
  status: z.enum(["all", "success", "error", "denied"]).default("all"),
});

/** E-postayı maskeler; denetim kaydına ham istemci verisi yazılmaz. */
function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}


/**
 * Kurucu giriş denemelerini kaydeder (giriş başarısız olabileceği için kimlik doğrulaması
 * gerekmez). Yazılan alanlar sabittir, e-posta maskelenir ve aynı istemci için hız sınırı
 * uygulanır; böylece denetim kaydı istemci verisiyle şişirilemez.
 */
export const logFounderLoginAttempt = createServerFn({ method: "POST" })
  .validator((input: unknown) => loginAttemptSchema.parse(input))
  .handler(async ({ data }) => {
    const { logAudit, tooManyRecentLoginLogs } = await import("./audit.server");
    if (await tooManyRecentLoginLogs()) return { ok: false };

    await logAudit({
      actorId: null,
      actorEmail: maskEmail(data.email),
      action: "founder.login",
      entity: "auth",
      status: data.status,
      detail: { source: "client", ...(data.reason ? { reason: data.reason } : {}) },
    });
    return { ok: true };
  });


export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => listSchema.parse(input ?? {}))
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