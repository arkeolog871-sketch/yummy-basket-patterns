import { useEffect, useRef, useState } from "react";
import { ensureLeaflet } from "@/lib/leaflet-loader";
import {
  didMapsAuthFail,
  ensureMapsLibrary,
  getGoogleMaps,
  subscribeMapsAuthFailure,
  watchMapContainerForAuthError,
} from "@/lib/google-maps-loader";
import { cleanMapStyle } from "@/lib/mapStyle";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import type { GoogleInfoWindow, GoogleMap, GoogleMarker } from "@/lib/google-maps-types";

export type LiveMapMarker = {
  lat: number;
  lng: number;
  title: string;
  href?: string;
  address?: string | null;
};

type LiveMapCanvasProps = {
  markers: LiveMapMarker[];
  label: string;
  showUserLocation?: boolean;
};

function isLovableDomain() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com");
}

/** Android WebView (uygulama APK). Google Maps JS burada genelde hatasız boş kalır. */
function isAndroidWebView() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Android/i.test(ua) && (/; wv\)/i.test(ua) || /Version\/4\.0/i.test(ua));
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function markerPopup(marker: LiveMapMarker) {
  const address = marker.address
    ? `<p style="margin:4px 0 0;font-size:12px;opacity:.75">${escapeHtml(marker.address)}</p>`
    : "";
  const link = marker.href
    ? `<a href="${escapeHtml(marker.href)}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#c8341f">Menüye git →</a>`
    : "";
  return `<div style="min-width:160px"><strong>${escapeHtml(marker.title)}</strong>${address}${link}</div>`;
}

function osmEmbedSrc(markers: LiveMapMarker[]) {
  const lats = markers.map((m) => m.lat);
  const lngs = markers.map((m) => m.lng);
  const pad = markers.length > 1 ? 0.02 : 0.01;
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad;
  const maxLng = Math.max(...lngs) + pad;
  const pin = markers[0]!;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${pin.lat}%2C${pin.lng}`;
}

function watchUserPosition(onPoint: (lat: number, lng: number) => void): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (pos) => onPoint(pos.coords.latitude, pos.coords.longitude),
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

function whenSized(el: HTMLElement, run: () => void): () => void {
  let started = false;
  let observer: ResizeObserver | null = null;
  let timeout = 0;
  const kick = () => {
    if (started) return;
    started = true;
    observer?.disconnect();
    window.clearTimeout(timeout);
    run();
  };
  observer = new ResizeObserver(() => {
    if (el.clientWidth > 0 && el.clientHeight > 0) kick();
  });
  timeout = window.setTimeout(kick, 400);
  observer.observe(el);
  if (el.clientWidth > 0 && el.clientHeight > 0) kick();
  return () => {
    started = true;
    observer?.disconnect();
    window.clearTimeout(timeout);
  };
}

export function LiveMapCanvas({ markers, label, showUserLocation = true }: LiveMapCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const { settings } = useSiteSettings();
  const mapsApiKey = settings.maps_api_key ?? null;
  const markerKey = JSON.stringify(
    markers.map(({ lat, lng, title, href, address }) => ({ lat, lng, title, href, address })),
  );

  useEffect(() => {
    if (markers.length === 0) return;
    const host = hostRef.current;
    if (!host) return;
    setReady(false);
    setIframeSrc(null);

    let cancelled = false;
    let stopWatching: (() => void) | undefined;
    let stopUser: (() => void) | undefined;
    let googleFallbackTimer: number | undefined;
    let osmInvalidateFrame: number | undefined;
    let osmInvalidateTimer: number | undefined;
    let googleMap: GoogleMap | null = null;
    const googleMarkers: GoogleMarker[] = [];
    let googleUser: GoogleMarker | null = null;
    let info: GoogleInfoWindow | null = null;
    let osmMap: { remove: () => void; invalidateSize: () => void } | null = null;
    let osmUser: {
      setLatLng: (ll: [number, number]) => unknown;
      bindPopup: (html: string) => unknown;
      remove: () => void;
    } | null = null;

    const showIframe = () => {
      if (cancelled) return;
      setIframeSrc(osmEmbedSrc(markers));
      setReady(true);
    };

    let osmStarted = false;
    const startOsm = async () => {
      if (osmStarted) return;
      osmStarted = true;
      stopWatching?.();
      stopWatching = undefined;
      stopUser?.();
      stopUser = undefined;
      info?.close();
      googleUser?.setMap(null);
      for (const pin of googleMarkers) pin.setMap(null);
      googleMarkers.length = 0;
      googleMap = null;
      try {
        const L = await ensureLeaflet();
        if (cancelled || !hostRef.current) {
          showIframe();
          return;
        }
        hostRef.current.replaceChildren();
        const map = L.map(hostRef.current, { scrollWheelZoom: true, zoomControl: true });
        osmMap = map;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);
        const pin = L.divIcon({
          className: "",
          html: '<div style="width:16px;height:16px;border-radius:50%;background:#c8341f;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const latlngs: [number, number][] = [];
        for (const marker of markers) {
          L.marker([marker.lat, marker.lng], { icon: pin, title: marker.title })
            .addTo(map)
            .bindPopup(markerPopup(marker));
          latlngs.push([marker.lat, marker.lng]);
        }
        if (latlngs.length > 1) {
          const bounds = L.latLngBounds(latlngs);
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
        } else if (latlngs[0]) {
          map.setView(latlngs[0], 16);
        }
        if (showUserLocation) {
          stopUser = watchUserPosition((lat, lng) => {
            if (cancelled) return;
            if (!osmUser) {
              osmUser = L.circleMarker([lat, lng], {
                radius: 8,
                color: "#fff",
                weight: 2,
                fillColor: "#2563eb",
                fillOpacity: 1,
              }).addTo(map);
              osmUser.bindPopup("Konumunuz");
            } else {
              osmUser.setLatLng([lat, lng]);
            }
          });
        }
        if (!cancelled) {
          setIframeSrc(null);
          setReady(true);
          osmInvalidateFrame = window.requestAnimationFrame(() => {
            osmInvalidateFrame = undefined;
            if (!cancelled && osmMap === map) map.invalidateSize();
          });
          osmInvalidateTimer = window.setTimeout(() => {
            osmInvalidateTimer = undefined;
            if (!cancelled && osmMap === map) map.invalidateSize();
          }, 250);
        }
      } catch {
        showIframe();
      }
    };

    const startGoogle = () => {
      let googleOk = false;
      const unsubscribeAuth = subscribeMapsAuthFailure(() => {
        if (googleOk) return;
        void startOsm();
      });

      ensureMapsLibrary(mapsApiKey)
        .then(() => {
          const maps = getGoogleMaps();
          const el = hostRef.current;
          if (cancelled || osmStarted) return;
          if (!el || !maps || didMapsAuthFail()) {
            void startOsm();
            return;
          }
          googleMap = new maps.Map(el, {
            zoom: markers.length > 1 ? 12 : 16,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: cleanMapStyle,
          });
          const bounds = new maps.LatLngBounds();
          for (const marker of markers) {
            const pin = new maps.Marker({
              position: { lat: marker.lat, lng: marker.lng },
              map: googleMap,
              title: marker.title,
            });
            const windowInfo = new maps.InfoWindow({ content: markerPopup(marker) });
            pin.addListener("click", () => {
              info?.close();
              if (!googleMap) return;
              windowInfo.open({ map: googleMap, anchor: pin });
              info = windowInfo;
            });
            googleMarkers.push(pin);
            bounds.extend({ lat: marker.lat, lng: marker.lng });
          }
          if (markers.length > 1) googleMap.fitBounds(bounds);
          else googleMap.setCenter({ lat: markers[0]!.lat, lng: markers[0]!.lng });

          if (showUserLocation) {
            stopUser = watchUserPosition((lat, lng) => {
              if (cancelled || !googleMap || !maps) return;
              if (!googleUser) {
                googleUser = new maps.Marker({
                  position: { lat, lng },
                  map: googleMap,
                  title: "Konumunuz",
                });
              } else {
                googleUser.setPosition({ lat, lng });
              }
            });
          }

          googleMap.addListener("tilesloaded", () => {
            if (osmStarted || cancelled) return;
            googleOk = true;
            setIframeSrc(null);
            setReady(true);
          });
          googleFallbackTimer = window.setTimeout(() => {
            if (cancelled || googleOk || osmStarted) return;
            void startOsm();
          }, 3500);

          const stopErr = watchMapContainerForAuthError(el, () => {
            if (googleOk) return;
            void startOsm();
          });
          stopWatching = () => {
            unsubscribeAuth();
            stopErr();
          };
        })
        .catch(() => {
          void startOsm();
        });

      if (!stopWatching) stopWatching = unsubscribeAuth;
    };

    const stopSized = whenSized(host, () => {
      if (cancelled) return;
      const canGoogle =
        !isAndroidWebView() &&
        (Boolean(mapsApiKey?.trim()) || isLovableDomain()) &&
        !didMapsAuthFail();
      if (canGoogle) startGoogle();
      else void startOsm();
    });

    return () => {
      cancelled = true;
      stopSized();
      stopWatching?.();
      stopUser?.();
      if (googleFallbackTimer !== undefined) window.clearTimeout(googleFallbackTimer);
      if (osmInvalidateFrame !== undefined) window.cancelAnimationFrame(osmInvalidateFrame);
      if (osmInvalidateTimer !== undefined) window.clearTimeout(osmInvalidateTimer);
      info?.close();
      googleUser?.setMap(null);
      for (const pin of googleMarkers) pin.setMap(null);
      googleMarkers.length = 0;
      googleMap = null;
      osmUser?.remove();
      osmMap?.remove();
      host.replaceChildren();
    };
  }, [markerKey, mapsApiKey, showUserLocation, markers]);

  return (
    <div className="relative mt-3 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted">
      <div ref={hostRef} className="absolute inset-0" aria-label={label} />
      {iframeSrc ? (
        <iframe
          title={label}
          src={iframeSrc}
          className="absolute inset-0 h-full w-full border-0"
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : null}
      {!ready ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-sm text-muted-foreground">Harita yükleniyor…</span>
        </div>
      ) : null}
    </div>
  );
}
