import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  completeNativeGoogleSignIn,
  humanizeOAuthError,
  startNativeGoogleSignIn,
} from "@/lib/google-oauth";

declare global {
  interface Window {
    /** Hesap seçimi bitince ID token buradan gelir. Boş string = kullanıcı vazgeçti. */
    __onNativeGoogleSignIn?: (idToken: string) => void;
    /**
     * Native akış bu cihazda kullanılamıyor (Play Services eski, kayıtlı hesap
     * yok, yapılandırma eksik…). Sessiz çıkmaz yerine tarayıcı akışına düşülür.
     */
    __onNativeGoogleSignInUnavailable?: () => void;
  }
}

/**
 * Android'de Google hesap seçimini Credential Manager ile uygulama içinde yapar.
 *
 * `start()` köprü yoksa false döner — çağıran taraf tarayıcı tabanlı
 * `startGoogleOAuth()`'a düşmeli (iOS, web, eski Android build'leri).
 * `onUnavailable`, native akış başlayıp başarısız olduğunda çağrılır; oraya da
 * tarayıcı akışı bağlanır, böylece giriş hiçbir durumda sessizce ölmez.
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
