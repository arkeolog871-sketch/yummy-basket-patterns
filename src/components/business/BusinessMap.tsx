import { useMemo } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { directionsLinkUrl, openDirections, resolveBusinessCoords, type BusinessLocation } from "@/lib/maps";
import { LiveMapCanvas } from "@/components/business/LiveMapCanvas";

export function BusinessMap({ business }: { business: BusinessLocation }) {
  const point = resolveBusinessCoords(business);
  const directionsUrl = directionsLinkUrl(business);
  const latitude = point?.lat;
  const longitude = point?.lng;
  const markers = useMemo(
    () =>
      latitude !== undefined && longitude !== undefined
        ? [
            {
              lat: latitude,
              lng: longitude,
              title: business.name,
              address: business.address ?? null,
            },
          ]
        : [],
    [business.address, business.name, latitude, longitude],
  );

  if (!point) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <MapPin className="size-4 text-primary" /> Konum
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Bu işletme için kayıtlı koordinat yok. Harita yerine yol tarifi bağlantısı kullanılabilir.
        </p>
        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              event.preventDefault();
              if (!openDirections(business)) toast.error("Bu işletme için konum bilgisi bulunamadı.");
            }}
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
      <LiveMapCanvas label={`${business.name} konum haritası`} markers={markers} />
      {directionsUrl ? (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            event.preventDefault();
            if (!openDirections(business)) toast.error("Bu işletme için konum bilgisi bulunamadı.");
          }}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" /> Yol tarifi al
        </a>
      ) : null}
    </div>
  );
}
