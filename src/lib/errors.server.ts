import { getRequestHeader } from "@tanstack/react-start/server";

const MESSAGE_LIMIT = 500;
const STACK_LIMIT = 4_000;

function clientMeta(): { ip: string | null; userAgent: string | null } {
  try {
    return {
      ip: getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? null,
      userAgent: getRequestHeader("user-agent") ?? null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/** Hassas veriyi kayda taşımamak için mesaj/izi temizler. */
function scrub(text: string): string {
  return text
    .replace(/(eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,})/g, "[TOKEN]")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[EPOSTA]")
    .replace(/(?:password|secret|token|apikey|api_key|code)["'\s:=]+[^\s"'&]+/gi, "$&".slice(0, 0) + "[REDACTED]");
}

export type ErrorRecordInput = {
  source: "client" | "server";
  message: string;
  stack?: string | null;
  path?: string | null;
  userId?: string | null;
};

/** Aynı hata kısa süre içinde tekrar gelirse yeni satır açmaz, sayacı artırır. */
export async function recordAppError(input: ErrorRecordInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = clientMeta();
    const message = scrub(input.message).slice(0, MESSAGE_LIMIT);
    const path = input.path ? input.path.slice(0, 300) : null;

    const { data: existing } = await supabaseAdmin
      .from("app_errors")
      .select("id, occurrences")
      .eq("message", message)
      .eq("source", input.source)
      .eq("resolved", false)
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("app_errors")
        .update({
          occurrences: (existing.occurrences ?? 1) + 1,
          last_seen_at: new Date().toISOString(),
          ...(path ? { path } : {}),
        })
        .eq("id", existing.id);
      return;
    }

    await supabaseAdmin.from("app_errors").insert({
      source: input.source,
      message,
      stack: input.stack ? scrub(input.stack).slice(0, STACK_LIMIT) : null,
      path,
      user_agent: meta.userAgent,
      ip: meta.ip,
      user_id: input.userId ?? null,
    });
  } catch (error) {
    console.error("[app-errors] kayıt yazılamadı", error);
  }
}
