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
export async function notifyAdminMessageAudience(input: {
  targetType: TargetType;
  restaurantId: string | null;
  title: string;
  body: string;
}): Promise<void> {
  try {
    const userIds = await resolveAudience(input.targetType, input.restaurantId);
    if (userIds.length === 0) return;
    const { sendPushToUserIds } = await import("./push.server");
    const url =
      input.targetType === "vendors" || input.targetType === "restaurant"
        ? "/vendor/dashboard"
        : "/bildirimler";
    await sendPushToUserIds(userIds, { title: input.title, body: input.body, url });
  } catch (error) {
    console.error("[admin-message-alert] push bildirimi başarısız", {
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}
