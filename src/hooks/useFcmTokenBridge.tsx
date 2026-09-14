import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { saveFcmToken } from "@/lib/push.functions";
import { getNativeIosFcmToken } from "@/lib/ios-native-push";

declare global {
  interface Window {
    /** android-wrapper (native Android), token hazır/yenilendiğinde bunu çağırır. */
    __onFcmToken?: (token: string) => void;
  }
}

/**
 * Android native uygulama (WebView) Web Push API'yi desteklemiyor; bunun
 * yerine android-wrapper bir FCM token'ı alıp bu köprü üzerinden JS'e
 * bildirir. Tarayıcıda/PWA'da (SilvanNative köprüsü yokken) hiçbir şey
 * yapmaz — zararsız no-op.
 *
 * iOS'ta itme yönü ters: token'ı native taraf kendiliğinden bildirmiyor,
 * buradan istiyoruz (SilvanPush eklentisi). Kaydın geri kalanı iki
 * platformda da aynı.
 */
export function FcmTokenBridge() {
  const { user } = useAuth();
  const save = useServerFn(saveFcmToken);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    window.__onFcmToken = (token: string) => {
      if (!token) return;
      void save({ data: { token } }).catch(() => {
        // Sessizce yut: token kaydı başarısız olsa bile uygulama akışı bozulmaz.
      });
    };

    // iOS: token native taraftan çekilir. Eklentisiz build'lerde ve
    // Android'de null döner, hiçbir şey olmaz.
    void getNativeIosFcmToken().then((token) => {
      if (!token) return;
      void save({ data: { token } }).catch(() => {
        // Sessizce yut: token kaydı başarısız olsa bile uygulama akışı bozulmaz.
      });
    });

    return () => {
      delete window.__onFcmToken;
    };
  }, [user, save]);

  return null;
}
