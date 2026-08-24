import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const mapsSchema = z.object({
  api_key: z.string().trim().max(200),
  allowed_referrers: z.string().trim().max(2000),
});

/** Tarayıcı haritası için anahtar; anahtar yönlendirici (referrer) kısıtlıdır. */
export const getMapsBrowserConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("maps_config")
    .select("api_key")
    .eq("id", "global")
    .maybeSingle();
  return { apiKey: data?.api_key ?? null };
});

/** Kurucu panelinde maskeli gösterim için: anahtar var mı, izinli adresler neler. */
export const getMapsAdminConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertFounder } = await import("./founder.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("maps_config")
      .select("api_key, allowed_referrers")
      .eq("id", "global")
      .maybeSingle();
    return {
      hasKey: Boolean(data?.api_key),
      maskedKey: data?.api_key ? `••••••••${data.api_key.slice(-4)}` : "",
      allowedReferrers: data?.allowed_referrers ?? "",
    };
  });

export const updateMapsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => mapsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertFounder } = await import("./founder.server");
    const { audited } = await import("./audit.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);
    const actorEmail = (context.claims as { email?: string } | null)?.email ?? null;

    return audited(
      {
        actorId: context.userId,
        actorEmail,
        action: "maps.update",
        entity: "maps_config",
        entityId: "global",
        detail: { hasKey: data.api_key.length > 0 },
      },
      async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("maps_config").upsert({
          id: "global",
          api_key: data.api_key || null,
          allowed_referrers: data.allowed_referrers || null,
          updated_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
        return { ok: true };
      },
    );
  });
