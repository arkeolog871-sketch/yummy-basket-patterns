type LeafletNamespace = {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap;
  tileLayer: (
    url: string,
    opts?: Record<string, unknown>,
  ) => { addTo: (map: LeafletMap) => unknown };
  marker: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletMarker;
  circleMarker: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletMarker;
  divIcon: (opts: Record<string, unknown>) => unknown;
  latLngBounds: (latlngs: [number, number][]) => { isValid: () => boolean };
  Icon?: {
    Default?: {
      mergeOptions: (opts: Record<string, string>) => void;
      imagePath?: string;
    };
  };
};

type LeafletMap = {
  setView: (latlng: [number, number], zoom: number) => LeafletMap;
  fitBounds: (bounds: unknown, opts?: Record<string, unknown>) => void;
  invalidateSize: () => void;
  remove: () => void;
};

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  bindPopup: (html: string) => LeafletMarker;
  setLatLng: (latlng: [number, number]) => LeafletMarker;
  remove: () => void;
};

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

const LEAFLET_VERSION = "1.9.4";
const LEAFLET_BASE = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist`;
const LEAFLET_IMAGES = `${LEAFLET_BASE}/images/`;

let leafletReady: Promise<LeafletNamespace> | null = null;

function loadStylesheet(href: string) {
  if (document.querySelector(`link[data-leaflet="true"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.crossOrigin = "anonymous";
  link.setAttribute("data-leaflet", "true");
  document.head.appendChild(link);
}

function pinDefaultIcons(L: LeafletNamespace) {
  try {
    L.Icon?.Default?.mergeOptions({
      iconUrl: `${LEAFLET_IMAGES}marker-icon.png`,
      iconRetinaUrl: `${LEAFLET_IMAGES}marker-icon-2x.png`,
      shadowUrl: `${LEAFLET_IMAGES}marker-shadow.png`,
    });
    if (L.Icon?.Default) L.Icon.Default.imagePath = LEAFLET_IMAGES;
  } catch {
    /* default pin assets are optional; we render divIcon markers */
  }
}

export function ensureLeaflet(): Promise<LeafletNamespace> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Harita yalnızca tarayıcıda yüklenir."));
  if (window.L) {
    pinDefaultIcons(window.L);
    return Promise.resolve(window.L);
  }
  if (!leafletReady) {
    leafletReady = new Promise((resolve, reject) => {
      loadStylesheet(`${LEAFLET_BASE}/leaflet.css`);
      const existing = document.querySelector('script[data-leaflet="true"]');
      if (existing) {
        existing.addEventListener("load", () => {
          if (!window.L) {
            leafletReady = null;
            reject(new Error("Leaflet yüklenemedi."));
            return;
          }
          pinDefaultIcons(window.L);
          resolve(window.L);
        });
        existing.addEventListener("error", () => {
          leafletReady = null;
          reject(new Error("Leaflet yüklenemedi."));
        });
        return;
      }
      const script = document.createElement("script");
      script.src = `${LEAFLET_BASE}/leaflet.js`;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.setAttribute("data-leaflet", "true");
      script.onload = () => {
        if (!window.L) {
          leafletReady = null;
          reject(new Error("Leaflet yüklenemedi."));
          return;
        }
        pinDefaultIcons(window.L);
        resolve(window.L);
      };
      script.onerror = () => {
        leafletReady = null;
        reject(new Error("Leaflet yüklenemedi."));
      };
      document.head.appendChild(script);
    });
  }
  return leafletReady;
}
