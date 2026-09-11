import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

export type PageManagerGrant = {
  id: string;
  user_id: string;
  city: string;
  district: string;
  is_active: boolean;
  created_at: string;
  email: string | null;
  full_name: string | null;
};

const grantSchema = z.object({
  userId: z.string().uuid(),
  city: z.string().trim().min(2).max(80),
  district: z.string().trim().min(2).max(80),
});

/** Sahip: verilen tüm bölgesel yetkileri listeler. */
export const listPageManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data, error } = await supabaseAdmin
        .from("page_manager_roles")
        .select("id, user_id, city, district, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      if (rows.length === 0) return [] as PageManagerGrant[];

      const userIds = [...new Set(rows.map((row) => row.user_id))];
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const nameById = new Map((profiles ?? []).map((row) => [row.id, row.full_name]));

      const emailById = new Map<string, string | null>();
      await Promise.all(
        userIds.map(async (id) => {
          const { data: user } = await supabaseAdmin.auth.admin.getUserById(id);
          emailById.set(id, user.user?.email ?? null);
        }),
      );

      return rows.map((row) => ({
        ...row,
        email: emailById.get(row.user_id) ?? null,
        full_name: nameById.get(row.user_id) ?? null,
      })) as PageManagerGrant[];
    }),
  );

/** Sahip: bir kullanıcıya belirli şehir/ilçe için sayfa yöneticiliği verir. */
export const grantPageManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => grantSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder, isOwnerAccount } = await import("./founder.server");
      const { audited } = await import("./audit.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      if (await isOwnerAccount(data.userId)) {
        throw new Error("Ana hesap sahibine ayrıca bölge yetkisi verilmez");
      }

      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "page_manager.grant",
          entity: "page_manager_roles",
          entityId: data.userId,
          detail: { city: data.city, district: data.district },
        },
        async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("page_manager_roles").upsert(
            {
              user_id: data.userId,
              granted_by: context.userId,
              city: data.city,
              district: data.district,
              is_active: true,
            },
            { onConflict: "user_id,city,district" },
          );
          if (error) throw new Error(error.message);
          return { ok: true };
        },
      );
    }),
  );

/** Sahip: verilen bölgesel yetkiyi tamamen geri alır. */
export const revokePageManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      const { audited } = await import("./audit.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);

      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "page_manager.revoke",
          entity: "page_manager_roles",
          entityId: data.id,
        },
        async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("page_manager_roles")
            .delete()
            .eq("id", data.id);
          if (error) throw new Error(error.message);
          return { ok: true };
        },
      );
    }),
  );
