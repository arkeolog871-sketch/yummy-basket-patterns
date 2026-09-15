import webpush from "web-push";

import { recordAppError } from "./errors.server";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

/** FCM tarafındaki ömür sınırıyla aynı: bir günü geçen bildirim düşer. */
const WEB_PUSH_TTL_SECONDS = 86_400;

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
async function sendWebPush(userIds: string[], payload: PushPayload): Promise<number> {
  if (!ensureWebPushConfigured()) return 0;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (error) {
    await recordAppError({
      source: "server",
      message: `[push] web push abonelikleri okunamadı: ${error.message}`,
    });
    return 0;
  }
  if (!subs || subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          // Varsayılan ömür 4 hafta: cihaz kapalıyken gönderilen bildirim
          // haftalar sonra açılışta düşüyordu. "high" aciliyeti de tarayıcı
          // push sunucusuna bildirimi bekletmemesini söyler.
          { TTL: WEB_PUSH_TTL_SECONDS, urgency: "high" },
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
  return subs.length;
}

/** Android native uygulama (FCM token'ı olan) abonelerine gönderir. Servis
 * hesabı tanımlı değilse sessizce atlanır. Geçersiz token'lar silinir. */
async function sendFcmPush(userIds: string[], payload: PushPayload): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tokens, error } = await supabaseAdmin
    .from("fcm_tokens")
    .select("id, token")
    .in("user_id", userIds);
  if (error) {
    await recordAppError({
      source: "server",
      message: `[push] cihaz kayıtları okunamadı: ${error.message}`,
    });
    return 0;
  }
  if (!tokens || tokens.length === 0) return 0;

  const { sendFcmMessage } = await import("./fcm.server");
  let unconfigured = false;
  await Promise.all(
    tokens.map(async (row) => {
      const result = await sendFcmMessage(row.token, payload);
      if (result === "invalid_token") {
        await supabaseAdmin.from("fcm_tokens").delete().eq("id", row.id);
      }
      if (result === "unconfigured") unconfigured = true;
    }),
  );
  if (unconfigured) {
    await recordAppError({
      source: "server",
      message:
        "[push] FCM servis hesabı tanımlı değil: hiçbir Android/iOS cihazına bildirim gönderilemiyor",
    });
    return 0;
  }
  return tokens.length;
}

/**
 * Herkese açık duyuruyu yayınlar.
 *
 * Native uygulamalara FCM yayın konusu üzerinden gider: cihaz açılışta bir kez
 * abone olduğu için sunucunun cihaz listesi tutmasına -- dolayısıyla
 * kullanıcının giriş yapmış olmasına -- gerek yok. Uygulamayı kurup hiç giriş
 * yapmamış bir telefon da duyuruyu alır. Eskiden yalnızca token listesine
 * gönderiliyordu ve token da yalnızca giriş yapılmışsa kaydediliyordu; kurulu
 * uygulamaların çoğu duyuruları hiç görmüyordu.
 *
 * Tarayıcı/PWA aboneleri konu yayınını desteklemiyor, onlara ayrıca gidilir.
 * Native cihazlara token ile İKİNCİ bir gönderim yapılmıyor: aynı bildirimi
 * iki kez gösterirdi.
 */
export type PushDelivery = {
  /** Bildirimin gittiği tarayıcı/PWA aboneliği sayısı. */
  web: number;
  /** Hedefli gönderimde ulaşılan cihaz sayısı; yayında -1 (sayı bilinemez). */
  devices: number;
  /** Yayın konusuna gönderildi mi? Hedefli gönderimde false. */
  broadcast: boolean;
};

export async function broadcastPush(
  webPushUserIds: string[],
  payload: PushPayload,
): Promise<PushDelivery> {
  const { sendFcmTopicMessage } = await import("./fcm.server");

  const [web, topic] = await Promise.all([
    sendWebPush([...new Set(webPushUserIds)].filter(Boolean), payload).catch((error) => {
      console.error("[push] web push yayını başarısız", error);
      return 0;
    }),
    sendFcmTopicMessage(payload).catch((error) => {
      console.error("[push] konu yayını başarısız", error);
      return "error" as const;
    }),
  ]);

  if (topic === "unconfigured") {
    await recordAppError({
      source: "server",
      message: "[push] FCM servis hesabı tanımlı değil: duyuru hiçbir native cihaza gönderilemiyor",
    });
    return { web, devices: -1, broadcast: false };
  }
  if (topic !== "sent" && web === 0) {
    await recordAppError({
      source: "server",
      message: `[push] duyuru yayınlanamadı (konu sonucu: ${topic}, web abonesi: ${web})`,
    });
  }
  return { web, devices: -1, broadcast: topic === "sent" };
}

/**
 * Verilen kullanıcıların hem Web Push (tarayıcı/PWA) hem FCM (Android native
 * uygulama) aboneliklerine bildirim gönderir. Hiçbir zaman throw etmez — bir
 * çağıranın ana akışını (sipariş, durum güncelleme, duyuru) asla bozmaz.
 */
export async function sendPushToUserIds(
  userIds: string[],
  payload: PushPayload,
): Promise<PushDelivery> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueIds.length === 0) return { web: 0, devices: 0, broadcast: false };

  const [web, fcm] = await Promise.all([
    sendWebPush(uniqueIds, payload).catch((error) => {
      console.error("[push] web push toplu gönderim başarısız", error);
      return 0;
    }),
    sendFcmPush(uniqueIds, payload).catch((error) => {
      console.error("[push] fcm toplu gönderim başarısız", error);
      return 0;
    }),
  ]);

  // Gönderim hiçbir cihaza ulaşmadıysa bunu kimse fark etmiyordu: duyuru
  // "gönderildi" görünüyor, telefonlarda hiçbir şey olmuyordu. Kayıtlı cihazı
  // olmayan bir hedef kitle, gönderenin bilmesi gereken bir durum.
  if (web === 0 && fcm === 0) {
    await recordAppError({
      source: "server",
      message: `[push] bildirim hiçbir cihaza gönderilemedi: ${uniqueIds.length} kullanıcının hiçbirinde kayıtlı cihaz yok`,
    });
  }
  return { web, devices: fcm, broadcast: false };
}
