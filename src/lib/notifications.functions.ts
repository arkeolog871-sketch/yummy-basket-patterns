import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { data, error } = await context.supabase
        .from("user_notifications")
        .select("id, kind, title, body, order_id, route, read_at, created_at, restaurant_id")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) {
        if (/does not exist|schema cache|42P01|PGRST205/i.test(error.message)) return { items: [] };
        throw new Error(error.message);
      }
      return { items: data ?? [] };
    }),
  );

export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { count, error } = await context.supabase
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .is("read_at", null);
      if (error) {
        if (/does not exist|schema cache|42P01|PGRST205/i.test(error.message)) return { count: 0 };
        throw new Error(error.message);
      }
      return { count: count ?? 0 };
    }),
  );

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { error } = await context.supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { error } = await context.supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .is("read_at", null);
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );

export const founderSendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        target: z.enum(["all", "all_vendors", "all_customers", "restaurant", "user"]),
        restaurantId: z.string().uuid().nullable().optional(),
        userId: z.string().uuid().nullable().optional(),
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      const { audited } = await import("./audit.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "notification.send",
          entity: "user_notifications",
          detail: {
            target: data.target,
            restaurant_id: data.restaurantId ?? null,
            user_id: data.userId ?? null,
          },
        },
        async () => {
          const { founderSendNotifications } = await import("./notifications.server");
          const result = await founderSendNotifications({
            target: data.target,
            restaurantId: data.restaurantId ?? null,
            userId: data.userId ?? null,
            title: data.title,
            body: data.body,
            founderUserId: context.userId,
          });
          return { ok: true, sent: result.sent };
        },
      );
    }),
  );
