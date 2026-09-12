import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { reportAppError } from "@/lib/errors.functions";
import {
  completeNativeGoogleSignIn,
  finishNativeAuthDiagnostics,
  humanizeOAuthError,
  startNativeGoogleSignIn,
  traceNativeAuth,
} from "@/lib/google-oauth";

declare global {
  interface Window {
    /** Hesap seçimi bitince ID token buradan gelir. Boş string = kullanıcı vazgeçti. */
    __onNativeGoogleSignIn?: (idToken: string) => void;
    /**
     * Native akış bu cihazda kullanılamıyor (Play Services eski, kayıtlı hesap
     * yok, yapılandırma eksik…). Sessiz çıkmaz yerine tarayıcı akışına düşülür.
     * `reason` native tarafın verdiği hata sınıfı/mesajı; sistem hata kaydına
     * yazılır, aksi hâlde native hatalar hiçbir yerde görünmüyor.
     */
    __onNativeGoogleSignInUnavailable?: (reason?: string) => void;
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
  const report = useServerFn(reportAppError);
  const fallbackRef = useRef(onUnavailable);
  fallbackRef.current = onUnavailable;

  useEffect(() => {
    window.__onNativeGoogleSignIn = (idToken: string) => {
      if (!idToken) {
        traceNativeAuth("boş token alındı (vazgeçme)");
        setBusy(false); // kullanıcı hesap seçmeden vazgeçti
        return;
      }
      traceNativeAuth(`ID token alındı (${idToken.length} karakter)`);
      setBusy(true);
      void completeNativeGoogleSignIn(idToken)
        .then((result) => {
          if (!result.ok) {
            finishNativeAuthDiagnostics(`supabase-hatasi: ${result.error}`);
            toast.error(result.error);
            return;
          }
          finishNativeAuthDiagnostics("ok");
        })
        .catch((error: unknown) => {
          finishNativeAuthDiagnostics(
            `istisna: ${error instanceof Error ? error.message : String(error)}`,
          );
          toast.error(humanizeOAuthError("Google girişi tamamlanamadı."));
        })
        .finally(() => setBusy(false));
    };
    window.__onNativeGoogleSignInUnavailable = (reason?: string) => {
      setBusy(false);
      traceNativeAuth(`native yol kullanılamadı, tarayıcı akışına düşülüyor: ${reason ?? "?"}`);
      // Native tarafın hataları şimdiye kadar hiçbir yere düşmüyordu; sistem
      // hata kaydına yaz ki bir dahaki başarısızlıkta sebebi tahmin etmeyelim.
      void report({
        data: {
          message: `Native Google girişi kullanılamadı: ${reason || "sebep bildirilmedi"}`.slice(
            0,
            1_000,
          ),
          path: window.location.pathname + window.location.search,
        },
      }).catch(() => undefined);
      fallbackRef.current?.();
    };
    return () => {
      delete window.__onNativeGoogleSignIn;
      delete window.__onNativeGoogleSignInUnavailable;
    };
  }, [report]);

  function start(): boolean {
    const started = startNativeGoogleSignIn();
    if (started) setBusy(true);
    return started;
  }

  return { busy, start };
}
