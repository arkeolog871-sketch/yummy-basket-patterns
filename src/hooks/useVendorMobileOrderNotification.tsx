import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { registerDevicePushToken } from "@/lib/vendor-mobile-notification.functions";
import {
  isAndroidShell,
  mobilePushPlatform,
  requestMobileNotificationPermission,
  showMobileNotification,
  waitForNativeFcmToken,
} from "@/lib/vendor-mobile-notification";

/** Android WebView: FCM token kaydı + yeni bildirimde yerel push. */
export function useVendorMobileOrderNotification(enabled: boolean) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const registerToken = useServerFn(registerDevicePushToken);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !user) return;
    requestMobileNotificationPermission();

    let cancelled = false;
    void (async () => {
      const token = await waitForNativeFcmToken();
      if (cancelled || !token) return;
      try {
        await registerToken({ data: { token, platform: mobilePushPlatform() } });
      } catch (error) {
        console.error("[mobile-push] token register failed", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, user, registerToken]);

  useEffect(() => {
    if (!enabled || !user) return;

    const channel = supabase
      .channel(`mobile-push:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            title?: string;
            body?: string;
          };
          if (!row.id || seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
          if (isAndroidShell()) {
            showMobileNotification(row.title ?? "Bildirim", row.body ?? "");
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, user, queryClient]);
}
