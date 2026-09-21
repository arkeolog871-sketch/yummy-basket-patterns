/**
 * Senkron jetonu yönetimi (istemci güvenli modül).
 *
 * Yetki aktarımla aynı kapıdan geçer: işletme kendi jetonunu, kurucu/bölge
 * yöneticisi yetki alanındaki işletmenin jetonunu yönetebilir.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";
import { assertImportAccess } from "./product-import.functions";

export type SyncTokenRow = {
  id: string;
  label: string | null;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

/** Aynı anda çok sayıda jeton anlamsız; kazara üretimi de sınırlar. */
const MAX_ACTIVE_TOKENS = 5;

export const listSyncTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await assertImportAccess(context, data.restaurantId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("restaurant_sync_tokens")
        .select("id, label, token_prefix, created_at, last_used_at")
        .eq("restaurant_id", data.restaurantId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(MAX_ACTIVE_TOKENS * 2);
      if (error) throw new Error(error.message);
      return {
        tokens: (rows ?? []).map((row): SyncTokenRow => ({
          id: row.id,
          label: row.label,
          tokenPrefix: row.token_prefix,
          createdAt: row.created_at,
          lastUsedAt: row.last_used_at,
        })),
      };
    }),
  );

/**
 * Yeni jeton üretir. Düz jeton SADECE burada, SADECE bir kez döner —
 * veritabanında yalnızca özeti saklanıyor, sonradan okunamaz.
 */
export const createSyncToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        restaurantId: z.string().uuid(),
        label: z.string().trim().max(80).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await assertImportAccess(context, data.restaurantId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const active = await supabaseAdmin
        .from("restaurant_sync_tokens")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", data.restaurantId)
        .is("revoked_at", null);
      if (active.error) throw new Error(active.error.message);
      if ((active.count ?? 0) >= MAX_ACTIVE_TOKENS) {
        throw new Error(
          `Bu işletmede zaten ${MAX_ACTIVE_TOKENS} etkin jeton var. Kullanılmayanları iptal edin.`,
        );
      }

      const { generateSyncToken, hashSyncToken, syncTokenPrefix } =
        await import("./sync-token.server");
      const token = generateSyncToken();
      const { error } = await supabaseAdmin.from("restaurant_sync_tokens").insert({
        restaurant_id: data.restaurantId,
        token_hash: await hashSyncToken(token),
        token_prefix: syncTokenPrefix(token),
        label: data.label?.trim() || null,
        created_by: context.userId,
      });
      if (error) throw new Error(error.message);

      const { audited } = await import("./audit.server");
      await audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "sync_token.create",
          entity: "restaurant_sync_tokens",
          entityId: data.restaurantId,
        },
        async () => true,
      );

      // Bir daha gösterilemez; arayüz bunu kullanıcıya açıkça söylüyor.
      return { token };
    }),
  );

export const revokeSyncToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ restaurantId: z.string().uuid(), tokenId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await assertImportAccess(context, data.restaurantId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // restaurant_id koşulu şart: aksi halde jeton kimliğini bilen biri
      // başka işletmenin jetonunu iptal edebilirdi.
      const { error } = await supabaseAdmin
        .from("restaurant_sync_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", data.tokenId)
        .eq("restaurant_id", data.restaurantId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );
