import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { claimGoogleOAuthFromApp, hasPendingGoogleOAuth } from "@/lib/google-oauth";

const POLL_INTERVAL_MS = 2500;
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
    let timer: number | undefined;

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

    const onVisible = () => {
      if (document.visibilityState === "visible") void attempt();
    };

    void attempt();
    timer = window.setInterval(() => void attempt(), POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
