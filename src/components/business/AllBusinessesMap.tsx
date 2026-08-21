import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { cleanMapStyle } from "@/lib/mapStyle";
import { ensureMapsLibrary, getGoogleMaps } from "@/lib/google-maps-loader";
import type { GoogleMap, GoogleMarker, GoogleInfoWindow } from "@/lib/google-maps-types";

interface MappableBusiness {
  id: string;
  slug: string;
  name: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  maps_url?: string | null;
}

interface AllBusinessesMapProps {
  businesses: MappableBusiness[];
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coordsFromMapsUrl(url: string | null | undefined) {
  if (!url) return null;
  const match =
    url.match(/[?&]q=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/) ??
    url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ??
    url.match(/[?&](?:ll|center)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/) ??
    url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function isLovableDomain() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com");
}

export function AllBusinessesMap({ businesses }: AllBusinessesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported" | "empty" | "error">("loading");

  useEffect(() => {
    const mappable = businesses
      .map((b) => {
        let lat = toNumber(b.latitude);
        let lng = toNumber(b.longitude);
        if (lat === null || lng === null) {
          const parsed = coordsFromMapsUrl(b.maps_url);
          if (!parsed) return null;
          lat = parsed.lat;
          lng = parsed.lng;
        }
        return { ...b, lat, lng };
      })
      .filter((b): b is MappableBusiness & { lat: number; lng: number } => b !== null);

    if (mappable.length === 0) {
      setStatus("empty");
      return;
    }

    let map: GoogleMap | null = null;
    const markers: GoogleMarker[] = [];
    let activeInfoWindow: GoogleInfoWindow | null = null;

    ensureMapsLibrary()
      .then(() => {
        const maps = getGoogleMaps();
        if (!containerRef.current || !maps) return;

        map = new maps.Map(containerRef.current, {
          zoom: mappable.length > 1 ? 12 : 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: cleanMapStyle,
        });

        const bounds = new maps.LatLngBounds();

        for (const business of mappable) {
          const marker = new maps.Marker({
            position: { lat: business.lat, lng: business.lng },
            map,
            title: business.name,
          });

          const infoWindow = new maps.InfoWindow({
            content: renderInfoContent(business),
          });

          marker.addListener("click", () => {
            activeInfoWindow?.close();
            infoWindow.open({ map: map!, anchor: marker });
            activeInfoWindow = infoWindow;
          });

          markers.push(marker);
          bounds.extend({ lat: business.lat, lng: business.lng });
        }

        if (mappable.length > 1) {
          map.fitBounds(bounds);
        } else {
          const first = mappable[0]!;
          map.setCenter({ lat: first.lat, lng: first.lng });
        }

        setStatus("ready");
      })
      .catch((error) => {
        console.error("AllBusinessesMap", error);
        setStatus(isLovableDomain() ? "error" : "unsupported");
      });

    return () => {
      activeInfoWindow?.close();
      for (const marker of markers) marker.setMap(null);
      map = null;
    };
  }, [businesses]);

  if (status === "unsupported") {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <MapPin className="size-4 text-primary" /> İşletmelerimiz
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Google Maps yalnızca <code className="rounded bg-muted px-1 py-0.5">*.lovable.app</code>{" "}
          adreslerinde görüntülenir. Kendi alan adınızda harita için ayrı bir Google Maps API anahtarı
          gerekir.
        </p>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <MapPin className="size-4 text-primary" /> İşletmelerimiz
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Henüz konum bilgisi girilmiş işletme yok. Kurucu panelinden işletmelere enlem/boylam veya
          Google Maps bağlantısı ekleyin; harita otomatik görünecek.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <MapPin className="size-4 text-primary" /> İşletmelerimiz
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          İşletme konumları haritada gösterilemiyor.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <MapPin className="size-4 text-primary" /> Tüm İşletmelerimiz
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Harita üzerindeki pinlere tıklayarak işletme detaylarını inceleyebilirsiniz.
      </p>
      <div
        ref={containerRef}
        className="mt-3 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted"
        aria-label="Tüm işletmeler haritası"
      >
        {status === "loading" ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-muted-foreground">Harita yükleniyor…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function renderInfoContent(business: MappableBusiness & { lat: number; lng: number }) {
  const address = business.address
    ? `<p class="text-xs text-muted-foreground mt-1">${escapeHtml(business.address)}</p>`
    : "";
  return `
    <div class="min-w-[180px] p-1">
      <h4 class="font-semibold text-sm">${escapeHtml(business.name)}</h4>
      ${address}
      <a href="/restoran/${encodeURIComponent(business.slug)}" class="mt-2 inline-block text-xs font-medium text-primary hover:underline">
        Menüye git →
      </a>
    </div>
  `;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default AllBusinessesMap;
