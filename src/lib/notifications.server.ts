type NotificationRow = {
  user_id: string;
  title: string;
  body: string;
  url: string | null;
  source_type: "admin_message" | "order_status";
  source_id: string | null;
};

/**
 * Bildirimi kullanıcı başına kalıcı kayıt olarak yazar. Duyurularda aynı
 * (user_id, source_id) çifti için ikinci satır oluşmaz — push kaç kez
 * tetiklenirse tetiklensin bildirim bir kez görünür.
 */
export async function insertNotifications(rows: NotificationRow[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminMessageRows = rows.filter((row) => row.source_type === "admin_message");
    const otherRows = rows.filter((row) => row.source_type !== "admin_message");

    if (adminMessageRows.length > 0) {
      await supabaseAdmin.from("notifications").upsert(adminMessageRows, {
        onConflict: "user_id,source_id",
        ignoreDuplicates: true,
      });
    }
    if (otherRows.length > 0) {
      await supabaseAdmin.from("notifications").insert(otherRows);
    }
  } catch (error) {
    console.error("[notifications] kayıt oluşturulamadı", {
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}
