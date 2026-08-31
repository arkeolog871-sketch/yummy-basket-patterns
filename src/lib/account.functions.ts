import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const requestSchema = z.object({
  phone: z.string().trim().max(25).optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
});

/** Kullanıcının mevcut hesap/veri silme talebini getirir. */
export const getMyDeletionRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("account_deletion_requests")
      .select("id, status, reason, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

/** Hesap/veri silme talebini kayıt altına alır; otomatik silme yapmaz. */
export const requestAccountDeletion = createServerFn({ method: "POST" })
  .validator((input: unknown) => requestSchema.parse(input ?? {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("account_deletion_requests")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (existing) return { ok: true as const, alreadyPending: true as const };

    const { error } = await context.supabase.from("account_deletion_requests").insert({
      user_id: context.userId,
      email: context.claims?.email ?? null,
      phone: data.phone ?? null,
      reason: data.reason ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, alreadyPending: false as const };
  });
