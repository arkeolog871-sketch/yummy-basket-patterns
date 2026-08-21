import type { GoogleMapsLibrary } from "@/lib/google-maps-types";

export function getGoogleMaps(): GoogleMapsLibrary | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { google?: { maps?: GoogleMapsLibrary } }).google?.maps;
}

let mapsReady: Promise<void> | null = null;

export async function ensureMapsLibrary(): Promise<void> {
  if (typeof window === "undefined") return;

  if (!mapsReady) {
    mapsReady = (async () => {
      if (!getGoogleMaps()?.importLibrary) {
        const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
        const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
        if (!key) throw new Error("Google Maps anahtarı yapılandırılmamış.");

        let script = document.querySelector('script[data-google-maps="true"]') as HTMLScriptElement | null;
        if (!script) {
          script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&channel=${encodeURIComponent(channel ?? "")}`;
          script.async = true;
          script.setAttribute("data-google-maps", "true");
          document.head.appendChild(script);
        }

        const el = script;
        await new Promise<void>((resolve, reject) => {
          if (getGoogleMaps()?.importLibrary) return resolve();
          el.addEventListener("load", () => resolve(), { once: true });
          el.addEventListener("error", () => reject(new Error("Google Maps yüklenemedi.")), { once: true });
          window.setTimeout(
            () => (getGoogleMaps()?.importLibrary ? resolve() : reject(new Error("Google Maps yüklenemedi."))),
            12000,
          );
        });
      }

      const maps = getGoogleMaps();
      if (!maps?.importLibrary) throw new Error("Google Maps yüklenemedi.");
      await maps.importLibrary("maps");
      await maps.importLibrary("marker");
    })();
  }

  try {
    await mapsReady;
  } catch (error) {
    mapsReady = null;
    throw error;
  }
}
