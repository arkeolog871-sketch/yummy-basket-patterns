import webpush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

let webPushConfigured: boolean | null = null;

/** VAPID anahtarları env'de yoksa web push sessizce atlanır (diğer kanallar etkilenmez). */
function ensureWebPushConfigured(): boolean {
  if (webPushConfigured !== null) return webPushConfigured;
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] || "mailto:destek@uygulamamcebimde.online";
  if (!publicKey || !privateKey) {
    console.error("[push] VAPID anahtarları tanımlı değil, web push devre dışı");
    webPushConfigured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  webPushConfigured = true;
  return true;
}

function statusCodeOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const value = (error as { statusCode?: unknown }).statusCode;
    return typeof value === "number" ? value : undefined;
  }
  return undefined;
}

/** Tarayıcı/PWA abonelerine Web Push (VAPID) ile gönderir. Süresi dolmuş/geçersiz
 * abonelikler (404/410) otomatik silinir. */
async function sendWebPush(userIds: string[], payload: PushPayload): Promise<void> {
  if (!ensureWebPushConfigured()) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (error || !subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (sendError) {
        const status = statusCodeOf(sendError);
        if (status === 404 || status === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[push] web push gönderilemedi", { subscriptionId: sub.id, status });
        }
      }
    }),
  );
}

/** Android native uygulama (FCM token'ı olan) abonelerine gönderir. Servis
 * hesabı tanımlı değilse sessizce atlanır. Geçersiz token'lar silinir. */
async function sendFcmPush(userIds: string[], payload: PushPayload): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tokens, error } = await supabaseAdmin
    .from("fcm_tokens")
    .select("id, token")
    .in("user_id", userIds);
  if (error || !tokens || tokens.length === 0) return;

  const { sendFcmMessage } = await import("./fcm.server");
  await Promise.all(
    tokens.map(async (row) => {
      const result = await sendFcmMessage(row.token, payload);
      if (result === "invalid_token") {
        await supabaseAdmin.from("fcm_tokens").delete().eq("id", row.id);
      }
    }),
  );
}

/**
 * Verilen kullanıcıların hem Web Push (tarayıcı/PWA) hem FCM (Android native
 * uygulama) aboneliklerine bildirim gönderir. Hiçbir zaman throw etmez — bir
 * çağıranın ana akışını (sipariş, durum güncelleme, duyuru) asla bozmaz.
 */
export async function sendPushToUserIds(userIds: string[], payload: PushPayload): Promise<void> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueIds.length === 0) return;

  await Promise.all([
    sendWebPush(uniqueIds, payload).catch((error) => {
      console.error("[push] web push toplu gönderim başarısız", error);
    }),
    sendFcmPush(uniqueIds, payload).catch((error) => {
      console.error("[push] fcm toplu gönderim başarısız", error);
    }),
  ]);
}
