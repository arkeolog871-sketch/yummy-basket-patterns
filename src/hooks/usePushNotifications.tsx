import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { savePushSubscription, deletePushSubscription } from "@/lib/push.functions";
import { getPublicSupabaseEnv } from "@/lib/public-env";

export type PushStatus =
  "idle" | "checking" | "loading" | "enabled" | "denied" | "unsupported" | "unconfigured" | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Sekme/uygulama kapalıyken de bildirim alabilmek için push aboneliği yönetir. */
export function usePushNotifications() {
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(deletePushSubscription);
  const [status, setStatus] = useState<PushStatus>("checking");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSupported()) {
        if (active) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setStatus("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        const subscription = await registration?.pushManager.getSubscription();
        if (active) setStatus(subscription ? "enabled" : "idle");
      } catch {
        if (active) setStatus("idle");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!isSupported()) {
      setStatus("unsupported");
      return;
    }
    const publicKey = getPublicSupabaseEnv().VITE_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setStatus("unconfigured");
      return;
    }
    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "idle");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.["p256dh"] || !json.keys?.["auth"]) {
        setStatus("error");
        return;
      }
      await save({
        data: { endpoint: json.endpoint, p256dh: json.keys["p256dh"], auth: json.keys["auth"] },
      });
      setStatus("enabled");
    } catch {
      setStatus("error");
    }
  }, [save]);

  const disable = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await remove({ data: { endpoint: subscription.endpoint } }).catch(() => {});
        await subscription.unsubscribe();
      }
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [remove]);

  return { status, enable, disable };
}
