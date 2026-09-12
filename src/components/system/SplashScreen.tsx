import { useEffect, useState } from "react";

/**
 * Splash en fazla bu kadar bekler. Ayarlar isteği hiç sonuçlanmazsa (kopuk
 * ya da çok yavaş bağlantı, DNS takılması) örtü kalkmıyordu; tam ekran ve
 * z-999 olduğu için de uygulama hiçbir dokunuşa cevap vermiyor, kullanıcıya
 * donmuş gibi görünüyordu. Renk şemasının bir an geç gelmesi, uygulamanın
 * hiç açılmamasından iyidir.
 */
const SPLASH_MAX_MS = 4_000;

/**
 * Site ayarları (renk şeması) yüklenene kadar geçen 1-2 saniyede eski/varsayılan
 * renklerin bir an görünmesini (FOUC) tam ekran logo ile örter; ayarlar hazır
 * olduğunda yumuşak geçişle kaybolur. `logo-mark.png`'nin kendi krem arka planıyla
 * (#F4EDDA) aynı zemin kullanılır, böylece görsel henüz yüklenmemişse bile
 * dikişsiz görünür.
 */
export function SplashScreen({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if ((!ready && !timedOut) || fading) return;
    setFading(true);
    const timer = setTimeout(() => setVisible(false), 320);
    return () => clearTimeout(timer);
  }, [ready, timedOut, fading]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-[#f4edda] transition-opacity duration-300 ease-out ${fading ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <img
        src="/logo-mark.png"
        alt=""
        className="h-[52vw] w-[52vw] max-h-80 max-w-80 rounded-[28%] sm:h-72 sm:w-72"
      />
    </div>
  );
}
