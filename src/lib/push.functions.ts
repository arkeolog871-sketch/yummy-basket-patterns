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

const fcmTokenSchema = z.object({
  token: z.string().trim().min(20).max(500),
  /** Kurulum başına sabit kimlik (tarayıcı localStorage). Eski sürümlerde yok. */
  deviceId: z.string().trim().min(8).max(64).optional(),
});

/**
 * Android/iOS native uygulamadan alınan cihaz token'ını kaydeder.
 *
 * FCM jetonu zamanla yenileniyor. Yalnızca `token` üzerinden upsert etmek,
 * yenilenen her jeton için yeni bir satır açıyor ve eskisini bırakıyordu; eski
 * jeton bir süre daha geçerli olduğu için duyuru aynı telefona iki kez
 * gidiyordu. `deviceId` geldiğinde o cihazın önceki jetonları siliniyor.
 */
export const saveFcmToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => fcmTokenSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      if (data.deviceId) {
        // Temizlik kullanıcıya göre DEĞİL cihaza göre yapılıyor. Aynı telefonda
        // hesap değiştirildiğinde (test sırasında olan buydu) o telefonun
        // jetonu ikinci bir kullanıcının altına da yazılıyor ve "herkese"
        // duyuru aynı telefona iki kez düşüyordu. Bir telefonun tek bir güncel
        // sahibi vardır: en son giriş yapan.
        //
        // Yan fayda: çıkış yapmış eski kullanıcının sipariş bildirimi, o
        // telefonu şimdi kullanan kişiye düşmüyor.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: cleanupError } = await supabaseAdmin
          .from("fcm_tokens")
          .delete()
          .eq("device_id", data.deviceId)
          .neq("token", data.token);
        // Temizlik başarısız olursa kayıt yine de yapılmalı: bildirim
        // gelmemesindense iki kez gelmesi yeğdir.
        if (cleanupError) console.error("[push] eski cihaz jetonu silinemedi");
      }

      const { error } = await context.supabase.from("fcm_tokens").upsert(
        {
          user_id: context.userId,
          token: data.token,
          ...(data.deviceId ? { device_id: data.deviceId } : {}),
        },
        { onConflict: "token" },
      );
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );
