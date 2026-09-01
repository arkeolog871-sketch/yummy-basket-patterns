import webpush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

let configured: boolean | null = null;

/** VAPID anahtarları env'de yoksa push sessizce atlanır (diğer bildirim kanalları etkilenmez). */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] || "mailto:destek@uygulamamcebimde.online";
  if (!publicKey || !privateKey) {
    console.error("[push] VAPID anahtarları tanımlı değil, push bildirimleri devre dışı");
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

function statusCodeOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const value = (error as { statusCode?: unknown }).statusCode;
    return typeof value === "number" ? value : undefined;
  }
  return undefined;
}

/**
 * Verilen kullanıcıların tüm push aboneliklerine bildirim gönderir.
 * Hiçbir zaman throw etmez — bir çağıranın ana akışını (sipariş, durum
 * güncelleme) asla bozmaz. Süresi dolmuş/geçersiz abonelikler (404/410)
 * otomatik silinir.
 */
export async function sendPushToUserIds(userIds: string[], payload: PushPayload): Promise<void> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueIds.length === 0) return;
  if (!ensureConfigured()) return;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", uniqueIds);
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
            console.error("[push] bildirim gönderilemedi", { subscriptionId: sub.id, status });
          }
        }
      }),
    );
  } catch (error) {
    console.error("[push] toplu gönderim başarısız", error);
  }
}
