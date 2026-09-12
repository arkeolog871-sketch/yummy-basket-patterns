import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
/**
 * Oturumun cihazda gerçekten kalıcı olup olmadığını ölçer. "Supabase tamam
 * dedi ama uygulama çıkış yapmış görünüyor" tablosunda kritik olan tek şey
 * bu: token geldi mi, localStorage'a yazılabiliyor mu, anahtar orada mı.
 * WebView'da localStorage sessizce başarısız olabiliyor ve sarmalayıcı
 * hatayı yutup belleğe düşüyor — o durumda giriş sayfa ömrü kadar yaşıyor.
 */
async function traceSessionHealth() {
  try {
    const probe = "__silvan_storage_probe__";
    let health: string;
    try {
      window.localStorage.setItem(probe, "1");
      health =
        window.localStorage.getItem(probe) === "1" ? "yazılıp okunuyor" : "yazıldı ama okunamadı";
      window.localStorage.removeItem(probe);
    } catch (error) {
      health = `hata: ${error instanceof Error ? error.name : String(error)}`;
    }
    traceNativeAuth(`localStorage: ${health}`);

    const authKeys = Object.keys(window.localStorage).filter((key) => key.includes("auth-token"));
    traceNativeAuth(`oturum anahtarı: ${authKeys.length ? authKeys.join(", ") : "YOK"}`);

    const { data, error } = await supabase.auth.getSession();
    traceNativeAuth(
      error
        ? `getSession hatası: ${error.message}`
        : `getSession: ${data.session ? `oturum var (${data.session.user.email ?? "e-posta yok"})` : "OTURUM YOK"}`,
    );
  } catch (error) {
    traceNativeAuth(
      `sağlık ölçümü çöktü: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

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
          void traceSessionHealth().finally(() => finishNativeAuthDiagnostics("ok"));
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
      // Play Services "Account reauth failed" derse hesabın cihazdaki
      // doğrulaması bayatlamış demektir; tarayıcı akışı çalışsa bile
      // kullanıcının bunu bilmesi gerekiyor, yoksa her seferinde tarayıcıya
      // düşmesinin sebebini anlamıyor.
      if (reason && /reauth|\[16\]/i.test(reason)) {
        toast.error(
          "Google hesabının cihazdaki doğrulaması yenilenmeli. Ayarlar › Hesaplar › Google adımından hesabı yeniden doğrulayın. Giriş tarayıcıdan sürdürülüyor.",
          { duration: 10_000 },
        );
      }
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
