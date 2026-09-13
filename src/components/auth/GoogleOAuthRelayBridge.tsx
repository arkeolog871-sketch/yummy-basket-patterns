import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  claimGoogleOAuthFromApp,
  hasPendingGoogleOAuth,
  readGoogleOAuthPkce,
} from "@/lib/google-oauth";

const FIRST_POLL_MS = 2000;
/**
 * Sabit 2,5 sn'lik yoklama, 5 dakikalık pencerede tek başına ~120 istek
 * üretiyordu; sunucudaki `google-oauth-claim` sınırı da 10 dakikada 120.
 * Yarım bırakılan tek bir giriş denemesi bu bütçeyi doldurup röleyi 10 dakika
 * boyunca susturuyordu (istek sınırı hatası sessizce yutuluyor). Kademeli
 * gecikme bunu ~40 isteğe indirmişti; kullanıcı tarayıcıdan dönünce görünürlük
 * olayı yoklamayı zaten anında ve baştaki hızla tetikliyor.
 *
 * Pencere 5 dakikaydı ve gerçek kullanımda dar kalıyordu: iOS'ta onay ayrı bir
 * Safari sekmesinde veriliyor, orada şifre + iki adımlı doğrulama (ya da ilk
 * kez hesap açma) 5 dakikayı rahat aşıyor. Süre dolduktan sonra kullanıcı
 * uygulamaya dönse bile bekleyen onay hiç teslim alınmıyordu.
 *
 * Artık pencere 15 dakika, ama ilk dakikadan sonra yoklama seyreltiliyor:
 * ~8 istek ilk dakikada, kalan 14 dakikada 30 sn'de bir ~28 istek → toplam
 * ~36. Sunucu bütçesinin (10 dakikada 120) belirgin şekilde altında.
 */
const EARLY_MAX_POLL_INTERVAL_MS = 8000;
const LATE_MAX_POLL_INTERVAL_MS = 30000;
const EARLY_WINDOW_MS = 60 * 1000;
const MAX_POLL_MS = 15 * 60 * 1000;

/**
 * Google girişi uygulama içinden başlatıldığında hesap seçimi güvenlik
 * gereği ayrı bir tarayıcı sekmesinde açılır. Kullanıcı orada onay verdiğinde
 * bu köprü, bekleyen onayı sunucudan alıp girişi doğrudan uygulama içinde
 * tamamlar; kullanıcının tarayıcı sayfasında beklemesi gerekmez.
 */
export function GoogleOAuthRelayBridge() {
  const busy = useRef(false);
  const startedAt = useRef(0);
  /** Hangi akışın saati tutuluyor; akış değişince pencere sıfırlanır. */
  const pendingState = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const attempt = async () => {
      if (cancelled || busy.current) return;
      if (!hasPendingGoogleOAuth()) {
        // Bekleyen akış yok: sayacı sıfırla. Sıfırlanmadığı için aynı sayfa
        // oturumunda ikinci bir giriş denemesi (ör. çıkış yapıp başka hesapla
        // girme) eski saati devralıyor ve süresi dolmuş sayılıp hiç
        // yoklanmıyordu.
        startedAt.current = 0;
        pendingState.current = null;
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const state = readGoogleOAuthPkce()?.state ?? null;
      if (state !== pendingState.current) {
        // Yeni bir giriş denemesi başladı (ör. süresi dolmuş bir denemenin
        // ardından tekrar denendi): pencereyi baştan başlat, yoksa yeni akış
        // eski saati devralıp anında "süresi doldu" sayılıyordu.
        pendingState.current = state;
        startedAt.current = 0;
      }
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
    /** Süre dolduğunda zamanlayıcı durur; yeni akışta buradan geri kurulur. */
    let running = false;

    /** İlk dakikada sık, sonrasında seyrek: uzun pencere ucuza gelsin. */
    const intervalCap = () => {
      if (!startedAt.current) return EARLY_MAX_POLL_INTERVAL_MS;
      return Date.now() - startedAt.current < EARLY_WINDOW_MS
        ? EARLY_MAX_POLL_INTERVAL_MS
        : LATE_MAX_POLL_INTERVAL_MS;
    };

    const schedule = () => {
      if (cancelled) return;
      // Süresi dolmuş bir akış için sonsuza kadar zamanlayıcı kurma; yeni bir
      // akış başlarsa görünürlük/odak olayı yoklamayı tekrar tetikliyor.
      if (startedAt.current && Date.now() - startedAt.current > MAX_POLL_MS) {
        running = false;
        return;
      }
      running = true;
      timer = window.setTimeout(() => void attempt().finally(schedule), interval);
      interval = Math.min(Math.round(interval * 1.5), intervalCap());
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Kullanıcı tarayıcıdan uygulamaya döndü: gecikmeyi sıfırla ki bekleyen
      // onay anında alınsın.
      interval = FIRST_POLL_MS;
      void attempt().finally(() => {
        // Süre dolduğu için durdurulmuş zamanlayıcıyı yeni akışta yeniden kur.
        if (!running && !cancelled) schedule();
      });
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
