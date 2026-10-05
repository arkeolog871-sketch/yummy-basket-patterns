import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { readOrCreateDeviceId } from "@/hooks/useFcmTokenBridge";
import { getMyPushRegistrationStatus, saveFcmToken } from "@/lib/push.functions";
import { getNativeIosFcmToken, hasNativeIosPush } from "@/lib/ios-native-push";
import { isNativeApp } from "@/lib/native-notify";

const DONE_KEY = (userId: string) => `silvan.business-push-prompt.v1.${userId}`;

/**
 * Hesabında hiç kayıtlı bildirim cihazı olmayan işletmelere, girişten sonra
 * bir kez "anlık bildirimlere izin ver" isteği gösterir. Kabul edilince
 * telefon hemen kaydedilir. Seçim (izin ya da "Daha sonra") bu cihazda
 * hatırlanır; istek bir daha çıkmaz.
 */
export function BusinessPushPrompt() {
  const { user } = useAuth();
  const checkStatus = useServerFn(getMyPushRegistrationStatus);
  const saveToken = useServerFn(saveFcmToken);
  const web = usePushNotifications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOpen(false);
      return;
    }
    try {
      if (window.localStorage.getItem(DONE_KEY(user.id))) return;
    } catch {
      return;
    }
    let cancelled = false;
    // Native köprünün jetonu kendiliğinden kaydetmesine birkaç saniye tanınır.
    const timer = setTimeout(() => {
      void checkStatus()
        .then((status) => {
          if (cancelled) return;
          if (!status.isBusiness) return;
          if (status.hasDevice) {
            window.localStorage.setItem(DONE_KEY(user.id), "registered");
            return;
          }
          setOpen(true);
        })
        .catch(() => {});
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user, checkStatus]);

  if (!open || !user) return null;

  const finish = (value: string) => {
    try {
      window.localStorage.setItem(DONE_KEY(user.id), value);
    } catch {
      /* yok say */
    }
    setOpen(false);
  };

  const allow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (hasNativeIosPush()) {
        const token = await getNativeIosFcmToken();
        if (!token) {
          setMessage(
            "Telefon bildirim kimliği veremedi. Ayarlar > Bildirimler'den bu uygulamaya izin verip tekrar deneyin.",
          );
          return;
        }
        const deviceId = readOrCreateDeviceId();
        await saveToken({ data: { token, ...(deviceId ? { deviceId } : {}) } });
        finish("registered");
        return;
      }
      if (isNativeApp()) {
        const pending = (window as Window & { __fcmTokenPending?: string | null })
          .__fcmTokenPending;
        if (pending) {
          const deviceId = readOrCreateDeviceId();
          await saveToken({ data: { token: pending, ...(deviceId ? { deviceId } : {}) } });
          finish("registered");
          return;
        }
        setMessage(
          "Telefon henüz bildirim kimliği vermedi. Uygulamayı kapatıp açın; istek yeniden gelir.",
        );
        return;
      }
      await web.enable();
    } catch {
      setMessage("Kayıt şu anda yapılamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  };

  // Tarayıcı izni sonucu
  if (!isNativeApp() && web.status === "enabled" && open) {
    queueMicrotask(() => finish("registered"));
  }

  const webBlocked = !isNativeApp() && web.status === "denied";
  const webUnsupported =
    !isNativeApp() && (web.status === "unsupported" || web.status === "unconfigured");

  return (
    <div
      role="dialog"
      aria-labelledby="business-push-title"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="business-push-title" className="font-display text-sm font-semibold">
            Siparişleri telefonunuzda anında görün
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Bu telefon bildirim için kayıtlı değil. İzin verirseniz yeni sipariş ve randevular
            uygulama kapalıyken de telefonunuza gelir.
          </p>
          {webBlocked ? (
            <p className="mt-2 text-xs text-destructive">
              Bildirim izni tarayıcı ayarlarından engellenmiş; oradan açmanız gerekiyor.
            </p>
          ) : null}
          {webUnsupported ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Bu tarayıcı anlık bildirimi desteklemiyor. Uygulamayı kullanmanızı öneririz.
            </p>
          ) : null}
          {message ? <p className="mt-2 text-xs text-destructive">{message}</p> : null}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="h-10 rounded-full px-5"
              disabled={busy || webBlocked || webUnsupported}
              onClick={() => void allow()}
            >
              {busy ? "Kaydediliyor…" : "İzin ver"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 rounded-full"
              onClick={() => finish("dismissed")}
            >
              Daha sonra
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Kapat"
          className="rounded-full p-1 text-muted-foreground"
          onClick={() => finish("dismissed")}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
