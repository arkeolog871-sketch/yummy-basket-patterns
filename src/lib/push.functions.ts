import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

const subscribeSchema = z.object({
  endpoint: z.string().trim().url().max(600),
  p256dh: z.string().trim().min(1).max(500),
  auth: z.string().trim().min(1).max(500),
});

/** Tarayıcıdan alınan push aboneliğini kaydeder/günceller (endpoint tekil). */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => subscribeSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const userAgent = (getRequestHeader("user-agent") ?? "").slice(0, 300) || null;
      const { error } = await context.supabase.from("push_subscriptions").upsert(
        {
          user_id: context.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: userAgent,
        },
        { onConflict: "endpoint" },
      );
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );

const unsubscribeSchema = z.object({
  endpoint: z.string().trim().url().max(600),
});

/** Tarayıcı aboneliği iptal ettiğinde (veya kullanıcı kapattığında) kaydı siler. */
export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => unsubscribeSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { error } = await context.supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", data.endpoint)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );
