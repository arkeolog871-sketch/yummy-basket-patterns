import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/hooks/useAccess";
import { getVendorMobileOrderAlert } from "@/lib/vendor-mobile-notification.functions";
import {
  claimVendorMobileNotification,
  formatVendorMobileNotification,
  isOrderId,
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
  const fetchAlertRef = useRef(fetchAlert);
  fetchAlertRef.current = fetchAlert;

  useEffect(() => {
    if (!isVendor || !restaurantId || !user?.id) return;
    requestVendorNotificationPermission();

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
      void supabase.removeChannel(channel);
    };
  }, [isVendor, restaurantId, user?.id, navigate]);

  return null;
}
