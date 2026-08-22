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

function watchUserPosition(onPoint: (lat: number, lng: number) => void): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (pos) => onPoint(pos.coords.latitude, pos.coords.longitude),
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function LiveMapCanvas({ markers, label, showUserLocation = true }: LiveMapCanvasProps) {
  const googleRef = useRef<HTMLDivElement>(null);
  const osmRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<"google" | "osm" | "loading">("loading");
  const { settings } = useSiteSettings();
  const mapsApiKey = settings.maps_api_key ?? null;
  const markerKey = markers.map((m) => `${m.lat},${m.lng},${m.title}`).join("|");

  useEffect(() => {
    if (markers.length === 0) return;
    let cancelled = false;
    let stopWatching: (() => void) | undefined;
    let stopUser: (() => void) | undefined;
    let googleMap: GoogleMap | null = null;
    const googleMarkers: GoogleMarker[] = [];
    let googleUser: GoogleMarker | null = null;
    let info: GoogleInfoWindow | null = null;
    let osmMap: { remove: () => void } | null = null;
    let osmUser: {
      setLatLng: (ll: [number, number]) => unknown;
      bindPopup: (html: string) => unknown;
      remove: () => void;
    } | null = null;

    const tryOsm = async () => {
      const L = await ensureLeaflet();
      if (cancelled || !osmRef.current) return;
      osmRef.current.replaceChildren();
      const map = L.map(osmRef.current, { scrollWheelZoom: true, zoomControl: true });
      osmMap = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
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
        setEngine("osm");
        window.setTimeout(() => map.invalidateSize(), 80);
      }
    };

    const failToOsm = () => {
      if (cancelled) return;
      void tryOsm().catch(() => {
        if (!cancelled) setEngine("osm");
      });
    };

    const canGoogle = Boolean(mapsApiKey?.trim()) || isLovableDomain();
    if (!canGoogle || didMapsAuthFail()) {
      failToOsm();
      return () => {
        cancelled = true;
        stopUser?.();
        osmMap?.remove();
      };
    }

    const unsubscribeAuth = subscribeMapsAuthFailure(failToOsm);

    ensureMapsLibrary(mapsApiKey)
      .then(() => {
        const maps = getGoogleMaps();
        if (cancelled || !googleRef.current || !maps || didMapsAuthFail()) {
          failToOsm();
          return;
        }
        googleMap = new maps.Map(googleRef.current, {
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

        if (!cancelled && !didMapsAuthFail()) setEngine("google");
        stopWatching = watchMapContainerForAuthError(googleRef.current, failToOsm);
      })
      .catch(() => failToOsm());

    return () => {
      cancelled = true;
      unsubscribeAuth();
      stopWatching?.();
      stopUser?.();
      info?.close();
      googleUser?.setMap(null);
      for (const pin of googleMarkers) pin.setMap(null);
      googleMap = null;
      osmUser?.remove();
      osmMap?.remove();
      googleRef.current?.replaceChildren();
      osmRef.current?.replaceChildren();
    };
  }, [markerKey, mapsApiKey, showUserLocation, markers]);

  return (
    <div className="relative mt-3 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted">
      <div
        ref={googleRef}
        className={engine === "google" ? "absolute inset-0" : "hidden"}
        aria-label={label}
      />
      <div
        ref={osmRef}
        className={engine === "osm" ? "absolute inset-0" : "hidden"}
        aria-label={label}
      />
      {engine === "loading" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-sm text-muted-foreground">Harita yükleniyor…</span>
        </div>
      ) : null}
    </div>
  );
}
