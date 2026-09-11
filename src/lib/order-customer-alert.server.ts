import { ORDER_STATUS_LABELS } from "@/lib/format";

type OrderForCustomerAlert = {
  id: string;
  user_id: string | null;
  restaurants?: { name: string } | null;
};

/**
 * Sipariş durumu değiştiğinde müşteriye push bildirimi gönderir. Sekme/uygulama
 * kapalıyken de ulaşması için — durum güncelleme akışını asla bozmaz, hata
 * yutulur.
 */
export async function notifyCustomerOfOrderStatus(
  order: OrderForCustomerAlert,
  status: string,
): Promise<void> {
  if (!order.user_id) return;
  try {
    const label = ORDER_STATUS_LABELS[status] ?? status;
    const restaurantName = order.restaurants?.name ?? "Siparişiniz";
    const title = "Sipariş durumu güncellendi";
    const body = `${restaurantName} — ${label}`;
    const url = `/siparis/${order.id}`;

    const { insertNotifications } = await import("./notifications.server");
    await insertNotifications([
      {
        user_id: order.user_id,
        title,
        body,
        url,
        source_type: "order_status" as const,
        source_id: order.id,
      },
    ]);

    const { sendPushToUserIds } = await import("./push.server");
    await sendPushToUserIds([order.user_id], { title, body, url });
  } catch (error) {
    console.error("[order-customer-alert] push bildirimi başarısız", {
      orderId: order.id,
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}
