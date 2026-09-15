type TargetType = "all" | "customers" | "vendors" | "restaurant";

/** Hedef kitleyi (herkes/müşteriler/işletmeler/tek işletme) gerçek kullanıcı id'lerine çözer. */
async function resolveAudience(
  targetType: TargetType,
  restaurantId: string | null,
): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (targetType === "restaurant") {
    if (!restaurantId) return [];
    const { data } = await supabaseAdmin
      .from("vendor_assignments")
      .select("user_id")
      .eq("restaurant_id", restaurantId);
    return (data ?? []).map((row) => row.user_id);
  }

  if (targetType === "vendors") {
    const { data } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "vendor");
    return (data ?? []).map((row) => row.user_id);
  }

  const { data: profiles } = await supabaseAdmin.from("profiles").select("id");
  const allIds = (profiles ?? []).map((row) => row.id);
  if (targetType === "all") return allIds;

  // "customers": yükseltilmiş rolü (vendor/founder/admin) olmayan herkes.
  const { data: elevated } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ["vendor", "founder", "admin"]);
  const excluded = new Set((elevated ?? []).map((row) => row.user_id));
  return allIds.filter((id) => !excluded.has(id));
}

/**
 * Kurucunun gönderdiği duyuruyu (admin_messages) hedef kitleye push olarak da
 * iletir — sekme/uygulama kapalıyken de ulaşsın diye. Duyuru zaten kaydedildi;
 * push başarısız olsa da duyuru akışını bozmaz.
 */
export type AudienceDelivery = {
  /** Hedef kitledeki kullanıcı sayısı. */
  audience: number;
  /** Bildirimin ulaştığı cihaz sayısı; yayında -1 (sayı bilinemez). */
  devices: number;
  /** Kurulu tüm uygulamalara yayınlandı mı? */
  broadcast: boolean;
};

export async function notifyAdminMessageAudience(input: {
  messageId?: string | null;
  targetType: TargetType;
  restaurantId: string | null;
  title: string;
  body: string;
}): Promise<AudienceDelivery> {
  const empty: AudienceDelivery = { audience: 0, devices: 0, broadcast: false };
  try {
    const userIds = await resolveAudience(input.targetType, input.restaurantId);
    if (userIds.length === 0) return empty;
    const url =
      input.targetType === "vendors" || input.targetType === "restaurant"
        ? "/vendor/dashboard"
        : "/bildirimler";

    // Kalıcı kayıt push'tan ÖNCE yazılır; okundu/okunmadı durumu buradan gelir.
    const { insertNotifications } = await import("./notifications.server");
    await insertNotifications(
      userIds.map((userId) => ({
        user_id: userId,
        title: input.title,
        body: input.body,
        url,
        source_type: "admin_message" as const,
        source_id: input.messageId ?? null,
      })),
    );

    // Aynı duyurunun konu ve token kopyaları tek bildirime indirgensin.
    const payload = {
      title: input.title,
      body: input.body,
      url,
      ...(input.messageId ? { collapseKey: input.messageId } : {}),
    };
    const { broadcastPush, sendPushToUserIds } = await import("./push.server");

    // "Herkese" duyuru, cihaz listesinden bağımsız yayın konusuyla gider:
    // uygulamayı kurmuş her telefona ulaşır, giriş yapılmış olması gerekmez.
    // Hedefli duyurular (işletmeler, tek işletme) belirli kullanıcıları
    // hedefliyor; onlar o kullanıcıların cihazlarına gönderilir.
    const delivery =
      input.targetType === "all"
        ? await broadcastPush(userIds, payload)
        : await sendPushToUserIds(userIds, payload);

    return {
      audience: userIds.length,
      devices: delivery.devices,
      broadcast: delivery.broadcast,
    };
  } catch (error) {
    console.error("[admin-message-alert] push bildirimi başarısız", {
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
    return empty;
  }
}
