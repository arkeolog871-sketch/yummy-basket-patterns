import { getRequestHeader } from "@tanstack/react-start/server";

export type AuditEntry = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  status?: "success" | "error" | "denied";
  detail?: Record<string, unknown>;
};

function requestMeta(): Record<string, unknown> {
  try {
    return {
      ip:
        getRequestHeader("cf-connecting-ip") ??
        getRequestHeader("x-forwarded-for") ??
        null,
      user_agent: getRequestHeader("user-agent") ?? null,
    };
  } catch {
    return {};
  }
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      status: entry.status ?? "success",
      detail: JSON.parse(
        JSON.stringify({ ...requestMeta(), ...(entry.detail ?? {}) }),
      ) as Record<string, string | number | boolean | null>,
    });
  } catch (error) {
    // Denetim kaydı yazılamazsa asıl işlemi bozmuyoruz.
    console.error("[audit] kayıt yazılamadı", error);
  }
}

/** İşlemi çalıştırır, sonucu (başarı/hata) denetim kaydına yazar. */
export async function audited<T>(entry: AuditEntry, run: () => Promise<T>): Promise<T> {
  try {
    const result = await run();
    await logAudit({ ...entry, status: "success" });
    return result;
  } catch (error) {
    await logAudit({
      ...entry,
      status: "error",
      detail: {
        ...(entry.detail ?? {}),
        message: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}