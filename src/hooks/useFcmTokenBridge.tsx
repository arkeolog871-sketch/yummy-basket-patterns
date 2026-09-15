import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { saveFcmToken } from "@/lib/push.functions";
import { getNativeIosFcmToken, hasNativeIosPush } from "@/lib/ios-native-push";

declare global {
  interface Window {
    /** android-wrapper (native Android), token hazır/yenilendiğinde bunu çağırır. */
    __onFcmToken?: (token: string) => void;
    /** Belge başındaki karşılayıcının tuttuğu token (public-env.ts). */
    __fcmTokenPending?: string | null;
  }
}

/**
 * Token, dinleyici kurulmadan önce gelirse burada bekler.
 *
 * Modül düzeyinde tutuluyor, bileşenin içinde değil: Android tarafı token'ı
 * sayfa yüklenir yüklenmez gönderiyor ve bu, React'in bağlanmasından bile
 * önce olabiliyor. Bileşen sonradan kurulduğunda tampona bakıp buradan
 * alıyor.
 */
let pendingToken: string | null = null;

/**
 * Cihazın bildirim kaydını sunucuya ulaştırır.
 *
 * Android: android-wrapper token'ı alıp `window.__onFcmToken` ile bildiriyor.
 * iOS: native taraf kendiliğinden bildirmiyor, SilvanPush eklentisinden
 * çekiliyor. Tarayıcıda/PWA'da ikisi de yok — zararsız no-op.
 *
 * Dinleyici oturumdan BAĞIMSIZ kuruluyor ve bu kritik. Eskiden `if (!user)
 * return` yüzünden `window.__onFcmToken` yalnızca oturum çözüldükten sonra
 * tanımlanıyordu; Android ise token'ı sayfa yüklenir yüklenmez gönderiyor ve
 * o an oturum genelde henüz çözülmemiş oluyor. Native taraftaki çağrı
 * `window.__onFcmToken && ...` biçiminde, yani fonksiyon yoksa sessizce hiçbir
 * şey yapmıyor -- tek deneme, tekrar yok. Kaydın olup olmaması oturumun ne
 * kadar hızlı çözüldüğüne, yani şansa kalmıştı: 14 kullanıcıdan yalnızca
 * 6'sının cihazı kayıtlıydı ve hiçbir yerde hata görünmüyordu.
 *
 * Artık token geldiği anda tamponlanıyor, oturum çözülünce kaydediliyor.
 * Sıra hangisi olursa olsun kayıp yok.
 */
export function FcmTokenBridge() {
  const { user } = useAuth();
  const save = useServerFn(saveFcmToken);
  const [token, setToken] = useState<string | null>(pendingToken);

  // Dinleyici: oturumu beklemez, mümkün olan en erken anda kurulur.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Belge başındaki karşılayıcı, React bağlanmadan önce gelen token'ı
    // tutuyor; devralınıyor.
    const caught = window.__fcmTokenPending;
    if (caught) pendingToken = caught;

    window.__onFcmToken = (incoming: string) => {
      if (!incoming) return;
      pendingToken = incoming;
      setToken(incoming);
    };
    if (pendingToken) setToken(pendingToken);

    return () => {
      delete window.__onFcmToken;
    };
  }, []);

  // iOS: token buradan istenir.
  //
  // Tek deneme yetmiyor. İlk kurulumda uygulama açılır açılmaz bildirim izni
  // soruluyor, ama sayfa kullanıcı daha "İzin Ver"e basmadan yükleniyor; o an
  // APNs kaydı olmadığı için Firebase token veremiyor. Aralıkları açarak
  // birkaç kez soruluyor, token gelir gelmez duruluyor.
  useEffect(() => {
    if (!hasNativeIosPush()) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const retryDelaysMs = [0, 3_000, 8_000, 20_000, 45_000];

    function attempt(index: number) {
      if (cancelled || index >= retryDelaysMs.length) return;
      timer = setTimeout(() => {
        void getNativeIosFcmToken().then((incoming) => {
          if (cancelled) return;
          if (!incoming) {
            attempt(index + 1);
            return;
          }
          pendingToken = incoming;
          setToken(incoming);
        });
      }, retryDelaysMs[index] ?? 0);
    }

    attempt(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Kayıt: token ve oturum hazır olduğunda, sıraları ne olursa olsun.
  useEffect(() => {
    if (!user || !token) return;
    void save({ data: { token } }).catch(() => {
      // Sessizce yut: token kaydı başarısız olsa bile uygulama akışı bozulmaz.
    });
  }, [user, token, save]);

  return null;
}
