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
      ip: getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? null,
      user_agent: getRequestHeader("user-agent") ?? null,
    };
  } catch {
    return {};
  }
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return "•••";
  return `${local.slice(0, 2)}${"•".repeat(Math.max(3, local.length - 2))}@${domain}`;
}

function redactDetail(value: unknown, key = ""): unknown {
  if (/password|token|secret|authorization|cookie|jwt|code/i.test(key)) return "[REDACTED]";
  if (/email/i.test(key) && typeof value === "string") return maskEmail(value);
  if (/phone/i.test(key) && typeof value === "string") return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redactDetail(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactDetail(childValue, childKey),
      ]),
    );
  }
  return value;
}

const PUBLIC_CACHE_ENTITIES = new Set([
  "restaurants",
  "menu_items",
  "menu_categories",
  "site_settings",
  "app_categories",
  "service_areas",
]);

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ? maskEmail(entry.actorEmail) : null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      status: entry.status ?? "success",
      detail: JSON.parse(
        JSON.stringify(redactDetail({ ...requestMeta(), ...(entry.detail ?? {}) })),
      ) as Record<string, string | number | boolean | null>,
    });
    if ((entry.status ?? "success") === "success" && PUBLIC_CACHE_ENTITIES.has(entry.entity)) {
      const { invalidatePublicCaches } = await import("./public-cache.server");
      invalidatePublicCaches();
    }
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
/**
 * Kimlik doğrulaması gerektirmeyen giriş denemesi kaydı için basit hız sınırı:
 * aynı IP son 10 dakikada 10'dan fazla kayıt yazamaz.
 */
export async function tooManyRecentLoginLogs(limit = 10): Promise<boolean> {
  return tooManyRecentAuditActions(["founder.login"], limit);
}

/** İşletme girişinde aynı IP için kaba kuvvet taramasını keser; normal kullanımın çok üzerindedir. */
export async function tooManyRecentVendorAttempts(limit = 40): Promise<boolean> {
  return tooManyRecentAuditActions(
    ["vendor.login.code_request", "vendor.login.code_verify"],
    limit,
  );
}

async function tooManyRecentAuditActions(actions: string[], limit: number): Promise<boolean> {
  try {
    const meta = requestMeta() as { ip?: string | null };
    const ip = meta.ip ?? null;
    if (!ip) return false;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .in("action", actions)
      .gte("created_at", since)
      .eq("detail->>ip", ip);
    if (error) return false;
    return (count ?? 0) >= limit;
  } catch {
    return false;
  }
}
