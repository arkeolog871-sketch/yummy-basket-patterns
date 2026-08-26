import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { businessDetailPath, resolveBusinessCoords } from "@/lib/maps";
import { LiveMapCanvas, type LiveMapMarker } from "@/components/business/LiveMapCanvas";

export interface MappableBusiness {
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

/** Pinler yalnızca latitude/longitude değerinden; bağlantı `/restoran/$slug`. */
export function businessMapMarkers(businesses: MappableBusiness[]): LiveMapMarker[] {
  return businesses.flatMap((business) => {
    try {
      const point = resolveBusinessCoords(business);
      if (!point) return [];
      return [
        {
          lat: point.lat,
          lng: point.lng,
          title: business.name,
          address: business.address ?? null,
          href: businessDetailPath(business.slug),
        },
      ];
    } catch {
      return [];
    }
  });
}

export function AllBusinessesMap({ businesses }: AllBusinessesMapProps) {
  const markers = useMemo(() => businessMapMarkers(businesses), [businesses]);

  if (markers.length === 0) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <MapPin className="size-4 text-primary" /> İşletmelerimiz
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Henüz konum bilgisi girilmiş işletme yok. Kurucu panelinden işletmelere enlem ve boylam
          ekleyin; harita otomatik görünecek.
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
        Harita üzerindeki pinlere tıklayarak işletme detaylarını inceleyebilirsiniz. Mavi nokta
        anlık konumunuzdur.
      </p>
      <LiveMapCanvas label="Tüm işletmeler haritası" markers={markers} />
    </div>
  );
}

export default AllBusinessesMap;
