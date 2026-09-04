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
    const { sendPushToUserIds } = await import("./push.server");
    const label = ORDER_STATUS_LABELS[status] ?? status;
    const restaurantName = order.restaurants?.name ?? "Siparişiniz";
    await sendPushToUserIds([order.user_id], {
      title: "Sipariş durumu güncellendi",
      body: `${restaurantName} — ${label}`,
      url: `/siparis/${order.id}`,
    });
  } catch (error) {
    console.error("[order-customer-alert] push bildirimi başarısız", {
      orderId: order.id,
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}
