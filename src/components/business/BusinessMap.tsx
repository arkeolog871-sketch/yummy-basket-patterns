import { useEffect, useRef, useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { buildMapsUrl, type BusinessLocation } from "@/lib/maps";
import { cleanMapStyle } from "@/lib/mapStyle";
import {
  didMapsAuthFail,
  ensureMapsLibrary,
  getGoogleMaps,
  subscribeMapsAuthFailure,
  watchMapContainerForAuthError,
} from "@/lib/google-maps-loader";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import type { GoogleMap, GoogleMarker } from "@/lib/google-maps-types";

function isLovableDomain() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com");
}

export function BusinessMap({ business }: { business: BusinessLocation }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported" | "error">("loading");
  const { settings } = useSiteSettings();
  const mapsApiKey = settings.maps_api_key ?? null;

  useEffect(() => {
    const lat = typeof business.latitude === "string" ? Number(business.latitude) : business.latitude;
    const lng = typeof business.longitude === "string" ? Number(business.longitude) : business.longitude;
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      setStatus("error");
      return;
    }

    let map: GoogleMap | null = null;
    let marker: GoogleMarker | null = null;
    let cancelled = false;
    let stopWatching: (() => void) | undefined;

    const fail = () => {
      if (cancelled) return;
      setStatus(mapsApiKey || isLovableDomain() ? "error" : "unsupported");
    };

    if (didMapsAuthFail()) {
      fail();
      return;
    }

    const unsubscribeAuth = subscribeMapsAuthFailure(fail);

    ensureMapsLibrary(mapsApiKey)
      .then(() => {
        const maps = getGoogleMaps();
        if (cancelled || !containerRef.current || !maps) return;
        if (didMapsAuthFail()) {
          fail();
          return;
        }
        map = new maps.Map(containerRef.current, {
          center: { lat, lng },
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: cleanMapStyle,
        });
        marker = new maps.Marker({
          position: { lat, lng },
          map,
          title: business.name,
        });
        if (!cancelled && !didMapsAuthFail()) setStatus("ready");
        if (containerRef.current) {
          stopWatching = watchMapContainerForAuthError(containerRef.current, fail);
        }
      })
      .catch((error) => {
        console.error(error);
        if (cancelled) return;
        toast.error("Harita yüklenemedi.");
        fail();
      });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      stopWatching?.();
      marker?.setMap(null);
      map = null;
      const node = containerRef.current;
      if (node) node.replaceChildren();
    };
  }, [business.latitude, business.longitude, business.name, mapsApiKey]);

  const directionsUrl = buildMapsUrl(business);

  if (status === "unsupported") {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <MapPin className="size-4 text-primary" /> Konum
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Google Maps yalnızca <code className="rounded bg-muted px-1 py-0.5">*.lovable.app</code> adreslerinde
          görüntülenir. Kendi alan adınızda harita için ayrı bir Google Maps API anahtarı gerekir.
        </p>
        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" /> Yol tarifi al
          </a>
        ) : null}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <MapPin className="size-4 text-primary" /> Konum
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">İşletme konumu haritada gösterilemiyor.</p>
        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" /> Yol tarifi al
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <MapPin className="size-4 text-primary" /> Konum
      </h3>
      <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-2xl bg-muted">
        <div
          ref={containerRef}
          className="absolute inset-0"
          aria-label={`${business.name} konum haritası`}
        />
        {status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted">
            <span className="text-sm text-muted-foreground">Harita yükleniyor…</span>
          </div>
        ) : null}
      </div>
      {directionsUrl ? (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" /> Yol tarifi al
        </a>
      ) : null}
    </div>
  );
}
