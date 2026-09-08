import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!ready || fading) return;
    setFading(true);
    const timer = setTimeout(() => setVisible(false), 320);
    return () => clearTimeout(timer);
  }, [ready, fading]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-[#f4edda] transition-opacity duration-300 ease-out ${fading ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <img src="/logo-mark.png" alt="" className="h-32 w-32 rounded-[28%] sm:h-40 sm:w-40" />
    </div>
  );
}
