import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppDownloadsOverview = {
  android:
    | {
        ok: true;
        totalInstalls: number | null;
        periodInstalls: number | null;
        lastDate: string | null;
      }
    | { ok: false; reason: string; detail?: string };
  ios:
    | { ok: true; totalDownloads: number; date: string | null }
    | { ok: false; reason: string; detail?: string };
};

/**
 * Sahibe özel: iki mağazanın indirme/kurulum sayılarını tek çağrıda döner.
 * Android (Play Console → Cloud Storage CSV) ve iOS (App Store Connect
 * Analytics Reports) tamamen ayrı sistemler; ikisi de başarısız olsa bile
 * panel çökmesin diye her biri kendi "ok" alanıyla dönüyor.
 */
export const getAppDownloadsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppDownloadsOverview> => {
    const { assertFounder } = await import("./founder.server");
    await assertFounder(context.supabase, context.userId, context.claims as never);

    const { getPlayDownloadStats } = await import("./google-play-downloads.server");
    const { getAppleDownloadStats } = await import("./apple-analytics-downloads.server");

    const [play, apple] = await Promise.all([getPlayDownloadStats(), getAppleDownloadStats()]);

    return {
      android: play.ok
        ? {
            ok: true,
            totalInstalls: play.stats.totalInstalls,
            periodInstalls: play.stats.periodInstalls,
            lastDate: play.stats.lastDate,
          }
        : {
            ok: false,
            reason: play.reason,
            ...("detail" in play && play.detail ? { detail: play.detail } : {}),
          },
      ios: apple.ok
        ? { ok: true, totalDownloads: apple.totalDownloads, date: apple.date }
        : {
            ok: false,
            reason: apple.reason,
            ...("detail" in apple && apple.detail ? { detail: apple.detail } : {}),
          },
    };
  });
