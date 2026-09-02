/**
 * Yeni bir hesap silme talebi geldiğinde kurucuya (ve admin rolündekilere) push
 * bildirimi gönderir. Talep zaten kaydedildi; push başarısız olsa da talep
 * akışını bozmaz.
 */
export async function notifyFoundersOfDeletionRequest(input: {
  requesterEmail: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: founders } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["founder", "admin"]);
    const userIds = [...new Set((founders ?? []).map((row) => row.user_id))];
    if (userIds.length === 0) return;

    const { sendPushToUserIds } = await import("./push.server");
    await sendPushToUserIds(userIds, {
      title: "Yeni hesap silme talebi",
      body: input.requesterEmail
        ? `${input.requesterEmail} hesabının silinmesini talep etti.`
        : "Bir kullanıcı hesabının silinmesini talep etti.",
      url: "/kurucu",
    });
  } catch (error) {
    console.error("[account-deletion-alert] push bildirimi başarısız", {
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}
