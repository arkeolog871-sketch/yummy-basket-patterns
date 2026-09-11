import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { claimGoogleOAuthFromApp, hasPendingGoogleOAuth } from "@/lib/google-oauth";

const FIRST_POLL_MS = 2000;
/**
 * Sabit 2,5 sn'lik yoklama, 5 dakikalık pencerede tek başına ~120 istek
 * üretiyordu; sunucudaki `google-oauth-claim` sınırı da 10 dakikada 120.
 * Yarım bırakılan tek bir giriş denemesi bu bütçeyi doldurup röleyi 10 dakika
 * boyunca susturuyordu (istek sınırı hatası sessizce yutuluyor). Kademeli
 * gecikme aynı süreyi ~40 istekle karşılıyor; kullanıcı tarayıcıdan dönünce
 * görünürlük olayı yoklamayı zaten anında ve baştaki hızla tetikliyor.
 */
const MAX_POLL_INTERVAL_MS = 8000;
const MAX_POLL_MS = 5 * 60 * 1000;

/**
 * Google girişi uygulama içinden başlatıldığında hesap seçimi güvenlik
 * gereği ayrı bir tarayıcı sekmesinde açılır. Kullanıcı orada onay verdiğinde
 * bu köprü, bekleyen onayı sunucudan alıp girişi doğrudan uygulama içinde
 * tamamlar; kullanıcının tarayıcı sayfasında beklemesi gerekmez.
 */
export function GoogleOAuthRelayBridge() {
  const busy = useRef(false);
  const startedAt = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const attempt = async () => {
      if (cancelled || busy.current) return;
      if (!hasPendingGoogleOAuth()) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (!startedAt.current) startedAt.current = Date.now();
      if (Date.now() - startedAt.current > MAX_POLL_MS) return;
      busy.current = true;
      try {
        const result = await claimGoogleOAuthFromApp();
        if (cancelled) return;
        if (result?.ok === true) {
          toast.success("Google girişi tamamlandı.");
        } else if (result?.ok === false) {
          toast.error(result.error);
        }
      } finally {
        busy.current = false;
      }
    };

    let timer: number | undefined;
    let interval = FIRST_POLL_MS;

    const schedule = () => {
      if (cancelled) return;
      timer = window.setTimeout(() => void attempt().finally(schedule), interval);
      interval = Math.min(Math.round(interval * 1.5), MAX_POLL_INTERVAL_MS);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Kullanıcı tarayıcıdan uygulamaya döndü: gecikmeyi sıfırla ki bekleyen
      // onay anında alınsın.
      interval = FIRST_POLL_MS;
      void attempt();
    };

    void attempt();
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
