type LeafletNamespace = {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (map: LeafletMap) => unknown };
  marker: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletMarker;
  circleMarker: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletMarker;
  divIcon: (opts: Record<string, unknown>) => unknown;
  latLngBounds: (latlngs: [number, number][]) => { isValid: () => boolean };
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

let leafletReady: Promise<LeafletNamespace> | null = null;

function loadStylesheet(href: string) {
  if (document.querySelector(`link[data-leaflet="true"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-leaflet", "true");
  document.head.appendChild(link);
}

export function ensureLeaflet(): Promise<LeafletNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("Harita yalnızca tarayıcıda yüklenir."));
  if (window.L) return Promise.resolve(window.L);
  if (!leafletReady) {
    leafletReady = new Promise((resolve, reject) => {
      loadStylesheet("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
      const existing = document.querySelector('script[data-leaflet="true"]');
      if (existing) {
        existing.addEventListener("load", () => (window.L ? resolve(window.L) : reject(new Error("Leaflet yüklenemedi."))));
        existing.addEventListener("error", () => reject(new Error("Leaflet yüklenemedi.")));
        return;
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.setAttribute("data-leaflet", "true");
      script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet yüklenemedi.")));
      script.onerror = () => {
        leafletReady = null;
        reject(new Error("Leaflet yüklenemedi."));
      };
      document.head.appendChild(script);
    });
  }
  return leafletReady;
}
