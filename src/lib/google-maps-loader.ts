import type { GoogleMapsLibrary } from "@/lib/google-maps-types";

export function getGoogleMaps(): GoogleMapsLibrary | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { google?: { maps?: GoogleMapsLibrary } }).google?.maps;
}

type AuthFailureListener = () => void;
const authFailureListeners = new Set<AuthFailureListener>();
let mapsAuthFailed = false;

/** Google, geçersiz/izinli olmayan anahtarda `window.gm_authFailure` çağırır. */
export function subscribeMapsAuthFailure(listener: AuthFailureListener): () => void {
  if (mapsAuthFailed) queueMicrotask(listener);
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

export function didMapsAuthFail() {
  return mapsAuthFailed;
}

function notifyMapsAuthFailure() {
  mapsAuthFailed = true;
  for (const listener of authFailureListeners) listener();
}

if (typeof window !== "undefined") {
  const host = window as unknown as { gm_authFailure?: () => void };
  const previous = host.gm_authFailure;
  host.gm_authFailure = () => {
    previous?.();
    notifyMapsAuthFailure();
  };
}

/** Google'ın İngilizce "Oops!" katmanını yakalayıp kendi yedek ekranımıza geçmek için. */
export function watchMapContainerForAuthError(
  container: HTMLElement,
  onError: () => void,
): () => void {
  const looksLikeAuthError = () =>
    Boolean(container.querySelector(".gm-err-container, .gm-err-message, .gm-err-title"));

  if (looksLikeAuthError()) {
    onError();
    return () => {};
  }

  const observer = new MutationObserver(() => {
    if (looksLikeAuthError()) onError();
  });
  observer.observe(container, { childList: true, subtree: true });
  const timeout = window.setTimeout(() => {
    if (looksLikeAuthError()) onError();
  }, 2500);

  return () => {
    observer.disconnect();
    window.clearTimeout(timeout);
  };
}

let mapsReady: Promise<void> | null = null;
let loadedMapsKey: string | null = null;

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

function canUseLovableConnectorKey() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com");
}

function resolveMapsKey(customKey?: string | null) {
  const trimmed = customKey?.trim();
  if (trimmed) return trimmed;
  if (canUseLovableConnectorKey()) {
    return import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined;
  }
  return undefined;
}

export async function ensureMapsLibrary(customKey?: string | null): Promise<void> {
  if (typeof window === "undefined") return;

  const key = resolveMapsKey(customKey) ?? "";
  if (mapsReady && loadedMapsKey !== key) {
    mapsReady = null;
    mapsAuthFailed = false;
  }

  if (!mapsReady) {
    loadedMapsKey = key;
    mapsReady = (async () => {
      const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
      const maps = getGoogleMaps();
      if (!maps || typeof maps.Map !== "function") {
        if (!key) throw new Error("Google Maps anahtarı yapılandırılmamış.");
        if (!document.querySelector('script[data-google-maps="true"]')) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=marker&channel=${encodeURIComponent(channel ?? "")}`;
            script.async = true;
            script.setAttribute("data-google-maps", "true");
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Google Maps betiği yüklenemedi."));
            document.head.appendChild(script);
          });
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
