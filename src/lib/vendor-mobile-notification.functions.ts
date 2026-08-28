import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

const platformSchema = z.enum(["android", "ios", "web"]);

export const registerDevicePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        token: z.string().trim().min(20).max(4096),
        platform: platformSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("device_push_tokens").upsert(
        {
          user_id: context.userId,
          token: data.token,
          platform: data.platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
      );
      if (error) {
        if (/does not exist|schema cache|42P01|PGRST205/i.test(error.message)) return { ok: true };
        throw new Error(error.message);
      }
      return { ok: true };
    }),
  );

export const unregisterDevicePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        token: z.string().trim().min(20).max(4096),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { error } = await context.supabase
        .from("device_push_tokens")
        .delete()
        .eq("user_id", context.userId)
        .eq("token", data.token);
      if (error) {
        if (/does not exist|schema cache|42P01|PGRST205/i.test(error.message)) return { ok: true };
        throw new Error(error.message);
      }
      return { ok: true };
    }),
  );
