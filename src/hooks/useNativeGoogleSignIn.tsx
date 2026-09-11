import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  completeNativeGoogleSignIn,
  humanizeOAuthError,
  startNativeGoogleSignIn,
} from "@/lib/google-oauth";

declare global {
  interface Window {
    /** android-wrapper (native Android), Google hesap seçimi bitince ID token'ı bunun üzerinden iletir. Boş string = kullanıcı vazgeçti. */
    __onNativeGoogleSignIn?: (idToken: string) => void;
    /**
     * Native akış bu cihazda/yapılandırmada kullanılamıyor (ör. Google Cloud'da
     * uygulamanın imza SHA-1'i ile kayıtlı Android istemcisi yok → DEVELOPER_ERROR).
     * Kullanıcıyı çıkmazda bırakmamak için tarayıcı akışına düşülür.
     */
    __onNativeGoogleSignInUnavailable?: () => void;
  }
}

/**
 * Android native köprüsü üzerinden (tarayıcıya hiç çıkmadan) Google girişi.
 * `start()` köprü yoksa false döner — çağıran taraf mevcut tarayıcı tabanlı
 * `startGoogleOAuth()`'a düşmeli (iOS, web, eski Android build'leri).
 */
export function useNativeGoogleSignIn(onUnavailable?: () => void) {
  const [busy, setBusy] = useState(false);
  const fallbackRef = useRef(onUnavailable);
  fallbackRef.current = onUnavailable;

  useEffect(() => {
    window.__onNativeGoogleSignIn = (idToken: string) => {
      if (!idToken) {
        setBusy(false); // kullanıcı hesap seçmeden vazgeçti
        return;
      }
      setBusy(true);
      void completeNativeGoogleSignIn(idToken)
        .then((result) => {
          if (!result.ok) toast.error(result.error);
        })
        .catch(() => {
          toast.error(humanizeOAuthError("Google girişi tamamlanamadı."));
        })
        .finally(() => setBusy(false));
    };
    window.__onNativeGoogleSignInUnavailable = () => {
      setBusy(false);
      fallbackRef.current?.();
    };
    return () => {
      delete window.__onNativeGoogleSignIn;
      delete window.__onNativeGoogleSignInUnavailable;
    };
  }, []);

  function start(): boolean {
    const started = startNativeGoogleSignIn();
    if (started) setBusy(true);
    return started;
  }

  return { busy, start };
}
