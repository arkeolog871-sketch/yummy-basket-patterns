import { useEffect, useState } from "react";
import { readAndClearOAuthDebugSnapshot } from "@/lib/google-oauth";

/**
 * Geçici tanı bandı: Google girişinin Android'de hangi bağlamda (WebView
 * köprüsü var mı, hangi dalın çalıştığı) tamamlandığını bir kerelik görmek
 * için. Kalıcı bir UI parçası değil — teşhis netleşince kaldırılacak.
 */
export function OAuthDebugBanner() {
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    // The snapshot is written a few hundred ms after this component's first
    // mount (mid-exchange, before a client-side SPA navigation swaps routes),
    // so a single check-on-mount misses it — poll briefly instead.
    const found = readAndClearOAuthDebugSnapshot();
    if (found) {
      setSnapshot(found);
      return;
    }
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      const value = readAndClearOAuthDebugSnapshot();
      if (value) {
        setSnapshot(value);
        window.clearInterval(interval);
      } else if (attempts >= 40) {
        window.clearInterval(interval);
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, []);

  if (!snapshot) return null;

  return (
    <div className="fixed inset-x-2 bottom-2 z-[9999] rounded-2xl border border-amber-400 bg-black/90 p-3 text-[11px] leading-relaxed text-amber-200 shadow-lg">
      <p className="font-semibold text-amber-300">OAuth tanı (geçici)</p>
      <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(snapshot, null, 2)}</pre>
      <button
        type="button"
        className="mt-2 rounded-full border border-amber-400 px-3 py-1 text-amber-200"
        onClick={() => setSnapshot(null)}
      >
        Kapat
      </button>
    </div>
  );
}
