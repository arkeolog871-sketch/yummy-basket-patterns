import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { saveFcmToken } from "@/lib/push.functions";
import { getNativeIosFcmToken, hasNativeIosPush } from "@/lib/ios-native-push";

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
    // Android'de hiç denenmez.
    //
    // Tek deneme yetmiyor. İlk kurulumda uygulama açılır açılmaz bildirim
    // izni soruluyor, ama bu sayfa kullanıcı daha "İzin Ver"e basmadan
    // yükleniyor; o an APNs kaydı olmadığı için Firebase token veremiyor.
    // Tek deneme yapılsaydı ilk kurulumda token hiç kaydedilmez, o cihaz
    // hiç bildirim almaz ve hiçbir yerde hata görünmezdi. Aralıkları açarak
    // birkaç kez soruluyor; token gelir gelmez duruluyor.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const retryDelaysMs = [0, 3_000, 8_000, 20_000, 45_000];

    function attempt(index: number) {
      if (cancelled || index >= retryDelaysMs.length) return;
      timer = setTimeout(() => {
        void getNativeIosFcmToken().then((token) => {
          if (cancelled) return;
          if (!token) {
            attempt(index + 1);
            return;
          }
          void save({ data: { token } }).catch(() => {
            // Sessizce yut: token kaydı başarısız olsa bile uygulama akışı bozulmaz.
          });
        });
      }, retryDelaysMs[index] ?? 0);
    }

    if (hasNativeIosPush()) attempt(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      delete window.__onFcmToken;
    };
  }, [user, save]);

  return null;
}
