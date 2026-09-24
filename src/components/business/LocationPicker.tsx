import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LocateFixed, MapPin } from "lucide-react";
import { ensureLeaflet } from "@/lib/leaflet-loader";
import {
  didMapsAuthFail,
  ensureMapsLibrary,
  getGoogleMaps,
  subscribeMapsAuthFailure,
} from "@/lib/google-maps-loader";
import { cleanMapStyle } from "@/lib/mapStyle";
import { getMapsBrowserConfig } from "@/lib/maps.functions";
import { isAndroidWebView } from "@/lib/maps";
import { SILVAN_DEFAULT_COORDS } from "@/lib/location";
import { Button } from "@/components/ui/button";
import type { GoogleMap, GoogleMarker } from "@/lib/google-maps-types";

export type PickedPoint = { lat: number; lng: number };

type LocationPickerProps = {
  value: PickedPoint | null;
  onChange: (point: PickedPoint) => void;
  label?: string;
  /** "İş yerim yok" seçiliyken: harita pasif, konum gerekmiyor. */
  disabled?: boolean;
};

const START_POINT: PickedPoint = {
  lat: SILVAN_DEFAULT_COORDS.latitude,
  lng: SILVAN_DEFAULT_COORDS.longitude,
};

/**
 * İşletme sahibinin kendi yerini haritada işaretlediği alan. Enlem/boylam
 * alanlarının yerini alır: kimse koordinat aramak zorunda kalmasın.
 *
 * Google anahtarı yoksa veya reddedilirse OpenStreetMap (Leaflet) ile aynı
 * işaretleme davranışı sürüyor; başvuru hiçbir koşulda kilitlenmiyor.
 */
export function LocationPicker({
  value,
  onChange,
  label = "İşletme konumu",
  disabled = false,
}: LocationPickerProps) {
  const fetchMapsConfig = useServerFn(getMapsBrowserConfig);
  const hostRef = useRef<HTMLDivElement>(null);
  // Harita bir kez kurulur; sonraki işaretleme değişiklikleri effect'i yeniden
  // çalıştırmasın diye güncel değer ve geri çağrı ref'te tutulur.
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [locating, setLocating] = useState(false);
  const [engine, setEngine] = useState<"loading" | "google" | "osm">("loading");
  const moveRef = useRef<((point: PickedPoint) => void) | null>(null);

  const mapsConfig = useQuery({
    queryKey: ["maps-browser-config"],
    queryFn: async () => {
      try {
        return await fetchMapsConfig();
      } catch {
        return { apiKey: null as string | null };
      }
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const mapsApiKey = mapsConfig.data?.apiKey ?? null;
  const configLoaded = !mapsConfig.isLoading;

  useEffect(() => {
    if (!configLoaded) return;
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let googleMap: GoogleMap | null = null;
    let googleMarker: GoogleMarker | null = null;
    let osmMap: { remove: () => void; invalidateSize: () => void } | null = null;
    let stopAuthWatch: (() => void) | undefined;
    const start = value ?? START_POINT;

    const startOsm = async () => {
      try {
        const L = await ensureLeaflet();
        if (cancelled || !hostRef.current) return;
        hostRef.current.replaceChildren();
        const map = L.map(hostRef.current, { scrollWheelZoom: true, zoomControl: true });
        osmMap = map;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);
        map.setView([start.lat, start.lng], value ? 17 : 14);
        const marker = L.marker([start.lat, start.lng], { draggable: true }).addTo(map);
        const publish = (lat: number, lng: number) => {
          marker.setLatLng([lat, lng]);
          changeRef.current({ lat, lng });
        };
        (marker as unknown as { on: (name: string, fn: (event: unknown) => void) => void }).on(
          "dragend",
          (event) => {
            const target = (
              event as { target?: { getLatLng?: () => { lat: number; lng: number } } }
            ).target;
            const point = target?.getLatLng?.();
            if (point) changeRef.current({ lat: point.lat, lng: point.lng });
          },
        );
        (map as unknown as { on: (name: string, fn: (event: unknown) => void) => void }).on(
          "click",
          (event) => {
            const latlng = (event as { latlng?: { lat: number; lng: number } }).latlng;
            if (latlng) publish(latlng.lat, latlng.lng);
          },
        );
        moveRef.current = (point) => {
          publish(point.lat, point.lng);
          map.setView([point.lat, point.lng], 17);
        };
        setEngine("osm");
        window.setTimeout(() => {
          if (!cancelled) osmMap?.invalidateSize();
        }, 200);
      } catch {
        if (!cancelled) setEngine("osm");
      }
    };

    const startGoogle = async () => {
      try {
        await ensureMapsLibrary(mapsApiKey);
        const maps = getGoogleMaps();
        const el = hostRef.current;
        if (cancelled) return;
        if (!el || !maps || didMapsAuthFail()) {
          void startOsm();
          return;
        }
        googleMap = new maps.Map(el, {
          zoom: value ? 17 : 14,
          center: { lat: start.lat, lng: start.lng },
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          styles: cleanMapStyle,
        });
        googleMarker = new maps.Marker({
          position: { lat: start.lat, lng: start.lng },
          map: googleMap,
          draggable: true,
          title: "İşletme konumu",
        });
        googleMarker.addListener("dragend", (event: unknown) => {
          const latLng = (event as { latLng?: { lat: () => number; lng: () => number } }).latLng;
          if (latLng) changeRef.current({ lat: latLng.lat(), lng: latLng.lng() });
        });
        googleMap.addListener("click", (event: unknown) => {
          const latLng = (event as { latLng?: { lat: () => number; lng: () => number } }).latLng;
          if (!latLng) return;
          const point = { lat: latLng.lat(), lng: latLng.lng() };
          googleMarker?.setPosition(point);
          changeRef.current(point);
        });
        moveRef.current = (point) => {
          googleMarker?.setPosition(point);
          googleMap?.setCenter(point);
          changeRef.current(point);
        };
        setEngine("google");
        stopAuthWatch = subscribeMapsAuthFailure(() => {
          if (cancelled) return;
          void startOsm();
        });
      } catch {
        if (!cancelled) void startOsm();
      }
    };

    const canGoogle = !isAndroidWebView() && Boolean(mapsApiKey?.trim()) && !didMapsAuthFail();
    if (canGoogle) void startGoogle();
    else void startOsm();

    return () => {
      cancelled = true;
      stopAuthWatch?.();
      moveRef.current = null;
      googleMarker?.setMap(null);
      googleMap = null;
      try {
        osmMap?.remove();
      } catch {
        /* teardown */
      }
      osmMap = null;
    };
    // Harita yalnızca anahtar çözümlendiğinde kurulur; işaretçi hareketleri
    // effect'i yeniden çalıştırmaz (aksi hâlde her dokunuşta harita sıfırlanır).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoaded, mapsApiKey]);

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (moveRef.current) moveRef.current(point);
        else changeRef.current(point);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MapPin className="size-3.5 text-primary" /> {label} — haritaya dokunun veya işaretçiyi
          sürükleyin
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={locating}
          onClick={useMyLocation}
        >
          <LocateFixed className="size-3.5" /> {locating ? "Bulunuyor…" : "Konumumu kullan"}
        </Button>
      </div>
      <div
        ref={hostRef}
        role="application"
        aria-label={label}
        className="h-64 w-full overflow-hidden rounded-2xl border border-border bg-muted"
      />
      <p className="text-xs text-muted-foreground">
        {disabled
          ? "İş yeri olmadığı için konum gerekmiyor."
          : value
            ? `İşaretlenen konum: ${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`
            : engine === "loading"
              ? "Harita yükleniyor…"
              : "Henüz konum işaretlenmedi. Başvuru için işletmenizin yerini işaretlemeniz gerekiyor."}
      </p>
    </div>
  );
}
