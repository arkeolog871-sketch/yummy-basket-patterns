import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";
import { useNotificationBridge } from "@/hooks/useNotificationBridge";

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listMyNotifications);
  const fetchUnread = useServerFn(getUnreadNotificationCount);
  const markRead = useServerFn(markNotificationRead);
  const markAllRead = useServerFn(markAllNotificationsRead);

  const { unreadCount } = useNotificationBridge();

  const listQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchList(),
    enabled: Boolean(user),
  });

  const unreadQuery = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: () => fetchUnread(),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    items: listQuery.data?.items ?? [],
    unreadCount: unreadQuery.data?.count ?? unreadCount,
    loading: listQuery.isLoading,
    markRead: async (id: string) => {
      await markRead({ data: { id } });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
    markAllRead: async () => {
      await markAllRead();
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
  };
}
