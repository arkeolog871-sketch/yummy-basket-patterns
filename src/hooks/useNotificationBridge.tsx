import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getUnreadNotificationCount } from "@/lib/notifications.functions";
import { useVendorMobileOrderNotification } from "@/hooks/useVendorMobileOrderNotification";

/** Header ve global köprü: okunmamış sayı + mobil push kaydı. */
export function useNotificationBridge() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchUnread = useServerFn(getUnreadNotificationCount);

  useVendorMobileOrderNotification(Boolean(user));

  const unreadQuery = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: () => fetchUnread(),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notification-count:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return { unreadCount: unreadQuery.data?.count ?? 0 };
}
