import { useEffect, useState } from "react";
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
  }
}

/**
 * Android native köprüsü üzerinden (tarayıcıya hiç çıkmadan) Google girişi.
 * `start()` köprü yoksa false döner — çağıran taraf mevcut tarayıcı tabanlı
 * `startGoogleOAuth()`'a düşmeli (iOS, web, eski Android build'leri).
 */
export function useNativeGoogleSignIn() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.__onNativeGoogleSignIn = (idToken: string) => {
      setBusy(false);
      if (!idToken) return; // kullanıcı hesap seçmeden vazgeçti
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
    return () => {
      delete window.__onNativeGoogleSignIn;
    };
  }, []);

  function start(): boolean {
    const started = startNativeGoogleSignIn();
    if (started) setBusy(true);
    return started;
  }

  return { busy, start };
}
