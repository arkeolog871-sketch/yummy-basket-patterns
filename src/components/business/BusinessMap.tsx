import { useEffect, useRef, useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { buildMapsUrl, type BusinessLocation } from "@/lib/maps";

declare global {
  interface Window {
    google?: {
      maps?: {
        Map: new (container: HTMLElement, options: Record<string, unknown>) => GoogleMap;
        Marker: new (options: Record<string, unknown>) => GoogleMarker;
      };
    };
  }
}

interface GoogleMap {
  setCenter(center: { lat: number; lng: number }): void;
}

interface GoogleMarker {
  setMap(map: GoogleMap | null): void;
}

function isLovableDomain() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com");
}

function loadMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.google?.maps) return resolve();

    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
    if (!key) return reject(new Error("Google Maps anahtarı yapılandırılmamış."));

    const existing = document.querySelector('script[data-google-maps="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google Maps yüklenemedi.")));
      return;
    }

    const callbackName = "__initBusinessMap__";
    (window as unknown as Record<string, unknown>)[callbackName] = () => resolve();

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${callbackName}&channel=${encodeURIComponent(channel ?? "")}`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-google-maps", "true");
    script.onerror = () => reject(new Error("Google Maps yüklenemedi."));
    document.head.appendChild(script);
  });
}

export function BusinessMap({ business }: { business: BusinessLocation }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported" | "error">("loading");

  useEffect(() => {
    if (!isLovableDomain()) {
      setStatus("unsupported");
      return;
    }

    const lat = typeof business.latitude === "string" ? Number(business.latitude) : business.latitude;
    const lng = typeof business.longitude === "string" ? Number(business.longitude) : business.longitude;
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      setStatus("error");
      return;
    }

    let map: GoogleMap | null = null;
    let marker: GoogleMarker | null = null;

    loadMapsScript()
      .then(() => {
        const maps = window.google?.maps;
        if (!containerRef.current || !maps) return;
        map = new maps.Map(containerRef.current, {
          center: { lat, lng },
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        marker = new maps.Marker({
          position: { lat, lng },
          map,
          title: business.name,
        });
        setStatus("ready");
      })
      .catch((error) => {
        console.error(error);
        toast.error("Harita yüklenemedi.");
        setStatus("error");
      });

    return () => {
      marker?.setMap(null);
      map = null;
    };
  }, [business.latitude, business.longitude, business.name]);

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
      <div
        ref={containerRef}
        className="mt-3 aspect-video w-full overflow-hidden rounded-2xl bg-muted"
        aria-label={`${business.name} konum haritası`}
      >
        {status === "loading" ? (
          <div className="flex h-full items-center justify-center">
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
