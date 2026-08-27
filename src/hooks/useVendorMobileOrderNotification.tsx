import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/hooks/useAccess";
import { getVendorMobileOrderAlert } from "@/lib/vendor-mobile-notification.functions";
import { registerVendorPushToken } from "@/lib/vendor-fcm.functions";
import {
  claimVendorMobileNotification,
  formatVendorMobileNotification,
  isOrderId,
  nativeNotifyBridge,
  requestVendorNotificationPermission,
  showVendorMobileNotification,
} from "@/lib/vendor-mobile-notification";

/**
 * İşletme kullanıcısına native/sistem bildirimi. Mevcut dashboard realtime
 * aboneliğini değiştirmez; sipariş INSERT'inden bağımsız dinler.
 */
export function VendorMobileOrderNotification() {
  const { user } = useAuth();
  const { isVendor, restaurantId } = useAccess();
  const navigate = useNavigate();
  const fetchAlert = useServerFn(getVendorMobileOrderAlert);
  const registerToken = useServerFn(registerVendorPushToken);
  const fetchAlertRef = useRef(fetchAlert);
  const registerTokenRef = useRef(registerToken);
  fetchAlertRef.current = fetchAlert;
  registerTokenRef.current = registerToken;

  useEffect(() => {
    if (!isVendor || !restaurantId || !user?.id) return;
    requestVendorNotificationPermission();

    const saveToken = (token: string) => {
      if (!token || token.length < 20) return;
      void registerTokenRef.current({ data: { token } }).catch(() => undefined);
    };
    saveToken(nativeNotifyBridge()?.getFcmToken?.() ?? "");
    const onToken = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === "string") saveToken(detail);
    };
    window.addEventListener("silvan-fcm-token", onToken);

    const userId = user.id;
    const origin = window.location.origin;
    const channel = supabase
      .channel(`vendor-mobile-push:${userId}:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as { id?: unknown };
          const orderId = typeof row.id === "string" ? row.id : "";
          if (!isOrderId(orderId)) return;
          if (!claimVendorMobileNotification(userId, orderId)) return;
          void fetchAlertRef
            .current({ data: { orderId } })
            .then((alert) => {
              if (!alert) return;
              const notice = formatVendorMobileNotification(alert, origin);
              const fcmToken = nativeNotifyBridge()?.getFcmToken?.() ?? "";
              const showLocal = !fcmToken || document.visibilityState === "visible";
              if (!showLocal) return;
              showVendorMobileNotification(notice, () => {
                void navigate({
                  to: "/vendor/dashboard",
                  search: { order: orderId },
                });
              });
            })
            .catch(() => {
              // Bildirim hatası siparişi etkilemez.
            });
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener("silvan-fcm-token", onToken);
      void supabase.removeChannel(channel);
    };
  }, [isVendor, restaurantId, user?.id, navigate]);

  return null;
}
