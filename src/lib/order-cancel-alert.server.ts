/**
 * Müşteri siparişi iptal ettiğinde işletmeye push bildirimi gönderir.
 * Sipariş zaten iptal edildi; bildirim başarısız olsa da iptal akışını
 * bozmaz.
 */
export async function notifyVendorOfCancelledOrder(input: {
  restaurantId: string;
  recipientName: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: vendorRows } = await supabaseAdmin
      .from("vendor_assignments")
      .select("user_id")
      .eq("restaurant_id", input.restaurantId);
    const userIds = (vendorRows ?? []).map((row) => row.user_id);
    if (userIds.length === 0) return;

    const { sendPushToUserIds } = await import("./push.server");
    await sendPushToUserIds(userIds, {
      title: "Sipariş iptal edildi",
      body: `${input.recipientName} siparişini iptal etti.`,
      url: "/vendor/dashboard",
    });
  } catch (error) {
    console.error("[order-cancel-alert] push bildirimi başarısız", {
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}
