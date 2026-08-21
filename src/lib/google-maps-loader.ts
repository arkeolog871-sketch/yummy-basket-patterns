import type { GoogleMapsLibrary } from "@/lib/google-maps-types";

export function getGoogleMaps(): GoogleMapsLibrary | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { google?: { maps?: GoogleMapsLibrary } }).google?.maps;
}

let mapsReady: Promise<void> | null = null;

function waitForMapConstructor(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const maps = getGoogleMaps();
      if (maps && typeof maps.Map === "function") return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error("Google Maps yüklenemedi."));
      window.setTimeout(tick, 150);
    };
    tick();
  });
}

export async function ensureMapsLibrary(): Promise<void> {
  if (typeof window === "undefined") return;

  if (!mapsReady) {
    mapsReady = (async () => {
      const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
      const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];

      const maps = getGoogleMaps();
      if (!maps || typeof maps.Map !== "function") {
        if (!key) throw new Error("Google Maps anahtarı yapılandırılmamış.");
        if (!document.querySelector('script[data-google-maps="true"]')) {
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=marker&channel=${encodeURIComponent(channel ?? "")}`;
          script.async = true;
          script.setAttribute("data-google-maps", "true");
          document.head.appendChild(script);
        }
      }

      const lib = getGoogleMaps();
      if (lib?.importLibrary) {
        await lib.importLibrary("maps");
      }
      await waitForMapConstructor();
    })();
  }

  try {
    await mapsReady;
  } catch (error) {
    mapsReady = null;
    throw error;
  }
}
