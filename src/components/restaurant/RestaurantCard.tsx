import { Link } from "@tanstack/react-router";
import { Star, Clock, Bike } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { deliverySummary } from "@/lib/delivery";
import { LocationButton } from "@/components/business/LocationButton";
import { isBusinessOpen, hoursLabel } from "@/lib/hours";

export type RestaurantSummary = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  category: string;
  sector?: string;
  cuisines: string[];
  rating: number;
  review_count: number;
  delivery_fee: number;
  delivery_type?: string | null;
  delivery_minutes: number;
  min_order: number;
  cover_image_url: string | null;
  logo_url?: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  maps_url?: string | null;
  opens_at?: string | null;
  closes_at?: string | null;
  is_open_manual?: boolean | null;
};

export function RestaurantCard({
  restaurant,
  categoryColor,
}: {
  restaurant: RestaurantSummary;
  /** Görseli olmayan işletmelerde zemin rengi olarak kullanılır (bkz. kategori renkleri). */
  categoryColor?: string | null | undefined;
}) {
  const open = isBusinessOpen(restaurant);
  const hours = hoursLabel(restaurant);
  return (
    <Link
      to="/restoran/$slug"
      params={{ slug: restaurant.slug }}
      className="group overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-lifted"
    >
      <div className="relative aspect-video overflow-hidden">
        {restaurant.cover_image_url ? (
          <img
            src={restaurant.cover_image_url}
            alt={`${restaurant.name} yemekleri`}
            loading="lazy"
            width={1280}
            height={720}
            className={`size-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              open ? "" : "grayscale"
            }`}
          />
        ) : (
          <div
            className={categoryColor ? "size-full" : "size-full bg-warm"}
            style={categoryColor ? { backgroundColor: `${categoryColor}33` } : undefined}
          />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold">
          {restaurant.category}
        </span>
        {!open ? (
          <span className="absolute right-3 top-3 rounded-full bg-foreground/85 px-3 py-1 text-xs font-semibold text-background">
            Şu An Kapalı
          </span>
        ) : (
          <span className="absolute right-3 top-3 rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground">
            {deliverySummary(restaurant.delivery_type, Number(restaurant.delivery_fee))}
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        {/* Çalışma saatleri afişin hemen altında, kendi satırında: bilgi
            satırının sonunda diğer rakamların arasında kaybolmuyordu. */}
        {hours ? (
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">{hours}</span>
          </p>
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={`${restaurant.name} logosu`}
                loading="lazy"
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-full border border-border/70 bg-card object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">{restaurant.name}</h3>
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                {restaurant.tagline}
              </p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-warm px-2 py-1 text-xs font-semibold text-warm-foreground">
            <Star className="size-3 fill-current" />
            {Number(restaurant.rating).toFixed(1)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" /> {restaurant.delivery_minutes} dk
          </span>
          <span className="flex items-center gap-1">
            <Bike className="size-3.5" />
            {deliverySummary(restaurant.delivery_type, Number(restaurant.delivery_fee))}
          </span>
          <span>Min. {formatPrice(Number(restaurant.min_order))}</span>
        </div>

        <LocationButton business={restaurant} className="text-xs text-muted-foreground" />
      </div>
    </Link>
  );
}
