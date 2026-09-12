import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  source_type: string;
  source_id: string | null;
  read_at: string | null;
  created_at: string;
};

/** Kullanıcının kendi bildirimlerini (en yeni önce) döner. */
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { data, error } = await context.supabase
        .from("notifications")
        .select("id, title, body, url, source_type, source_id, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as NotificationItem[];
    }),
  );

/** Zil rozetinde gösterilen okunmamış bildirim sayısı. */
export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { count, error } = await context.supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (error) throw new Error(error.message);
      return { count: count ?? 0 };
    }),
  );

const markSchema = z.object({
  ids: z.array(z.string().uuid()).max(200).optional(),
});

/** Verilen bildirimleri (veya tümünü) okundu olarak işaretler. */
export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => markSchema.parse(input ?? {}))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      let query = context.supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (data.ids && data.ids.length > 0) query = query.in("id", data.ids);
      const { error } = await query;
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );

const deleteSchema = z.object({
  /** Boş bırakılırsa kullanıcının tüm bildirimleri silinir. */
  ids: z.array(z.string().uuid()).min(1).max(200).optional(),
});

/**
 * Kullanıcının kendi bildirimlerini siler. RLS politikası sahiplik üzerinden
 * kurulu olduğu için sorgu yalnızca çağıran kullanıcının satırlarına dokunur;
 * rol ayrımı yok, herkes yalnızca kendi bildirimini silebilir.
 */
export const deleteMyNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => deleteSchema.parse(input ?? {}))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      let query = context.supabase.from("notifications").delete();
      if (data.ids && data.ids.length > 0) {
        query = query.in("id", data.ids);
      } else {
        // Tümünü sil: filtre zorunlu, sahiplik zaten RLS'te. `id` her satırda dolu.
        query = query.not("id", "is", null);
      }
      const { error } = await query;
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );
