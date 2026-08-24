import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Kurucu hesabının iki adımlı doğrulama / yedek kod durumu. */
export const getFounderSecurity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    enforceSensitiveRateLimit("backup-code-regenerate", 3, 60 * 60 * 1000);
    const { assertFounder } = await import("./founder.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    const { data, error } = await context.supabase
      .from("founder_backup_codes")
      .select("id, used_at")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    return {
      total: rows.length,
      remaining: rows.filter((row) => row.used_at === null).length,
    };
  });

/** Yeni yedek kod seti üretir; eski kodlar geçersiz olur. Kodlar yalnızca burada bir kez döner. */
export const regenerateBackupCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    const { generateBackupCodes, hashBackupCode } = await import("./security.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    const codes = generateBackupCodes(10);

    return audited(
      {
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
        action: "security.backup_codes.regenerate",
        entity: "founder_backup_codes",
        entityId: context.userId,
        detail: { count: codes.length },
      },
      async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: deleteError } = await supabaseAdmin
          .from("founder_backup_codes")
          .delete()
          .eq("user_id", context.userId);
        if (deleteError) throw new Error(deleteError.message);

        const { error } = await supabaseAdmin.from("founder_backup_codes").insert(
          codes.map((code) => ({
            user_id: context.userId,
            code_hash: hashBackupCode(context.userId, code),
          })),
        );
        if (error) throw new Error(error.message);
        return { codes };
      },
    );
  });

/** Yedek kodu doğrular ve tek kullanımlık olarak işaretler. */
export const redeemBackupCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ code: z.string().trim().min(6).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    enforceSensitiveRateLimit("backup-code-verify", 8, 15 * 60 * 1000);
    const { isFounderUser } = await import("./founder.server");
    const { logAudit } = await import("./audit.server");
    const { hashBackupCode } = await import("./security.server");
    const actorEmail = (context.claims as { email?: string } | null)?.email ?? null;

    const { assertCanVerify, registerFailedAttempt, clearGuard } = await import("./otp.server");
    const guardEmail = `backup:${context.userId}@guard.local`;
    const allowed = await assertCanVerify(guardEmail);
    if (!allowed.ok) throw new Error(allowed.error);

    const isFounder = await isFounderUser(context.supabase, context.userId);
    if (!isFounder) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = hashBackupCode(context.userId, data.code);
    const { data: match, error } = await supabaseAdmin
      .from("founder_backup_codes")
      .select("id")
      .eq("user_id", context.userId)
      .eq("code_hash", hash)
      .is("used_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!match) {
      await registerFailedAttempt(guardEmail);
      await logAudit({
        actorId: context.userId,
        actorEmail,
        action: "security.backup_code.use",
        entity: "founder_backup_codes",
        status: "denied",
        detail: { reason: "Geçersiz veya kullanılmış kod" },
      });
      throw new Error("Yedek kod geçersiz veya daha önce kullanılmış");
    }

    const { error: updateError } = await supabaseAdmin
      .from("founder_backup_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", match.id);
    if (updateError) throw new Error(updateError.message);

    await clearGuard(guardEmail);
    await logAudit({
      actorId: context.userId,
      actorEmail,
      action: "security.backup_code.use",
      entity: "founder_backup_codes",
      entityId: match.id,
    });
    return { ok: true };
  });
