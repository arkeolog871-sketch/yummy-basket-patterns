import { Link } from "@tanstack/react-router";
import { Star, Clock, Bike } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { deliverySummary } from "@/lib/delivery";
import { LocationButton } from "@/components/business/LocationButton";
import { isWithinHours, hoursLabel } from "@/lib/hours";

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
  mobile_service?: boolean | null;
  opens_at?: string | null;
  closes_at?: string | null;
  is_open_manual?: boolean | null;
  /** Aramada ürün adıyla eşleştiyse o ürünler (en çok 3). */
  matched_products?: string[];
};

export function RestaurantCard({
  restaurant,
  categoryColor,
  compact = false,
}: {
  restaurant: RestaurantSummary;
  /** Görseli olmayan işletmelerde zemin rengi olarak kullanılır (bkz. kategori renkleri). */
  categoryColor?: string | null | undefined;
  compact?: boolean;
}) {
  // Yalnızca çalışma saatlerine bakılır: "sipariş alıyor" anahtarı kapalı
  // (yalnızca vitrin/reklam amaçlı işletme) kartta "Kapalı" göstermez —
  // kart normal bir aktif ilan gibi görünmeye devam eder. Sipariş
  // engellemesi işletme sayfasındaki menüde ve sepet ekleme adımında kalır.
  const open = isWithinHours(restaurant);
  const hours = hoursLabel(restaurant);
  return (
    <Link
      to="/restoran/$slug"
      params={{ slug: restaurant.slug }}
      className={`group min-w-0 overflow-hidden border border-border/70 bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-lifted ${compact ? "rounded-lg" : "rounded-3xl"}`}
    >
      <div className="relative aspect-video overflow-hidden">
        {restaurant.cover_image_url ? (
          <img
            src={restaurant.cover_image_url}
            alt={`${restaurant.name} yemekleri`}
            loading="lazy"
            width={1280}
            height={720}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className={categoryColor ? "size-full" : "size-full bg-warm"}
            style={categoryColor ? { backgroundColor: `${categoryColor}33` } : undefined}
          />
        )}
        {!compact ? (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold">
            {restaurant.category}
          </span>
        ) : null}
        {compact ? null : !open ? (
          <span className="absolute right-3 top-3 rounded-full bg-foreground/85 px-3 py-1 text-xs font-semibold text-background">
            Şu An Kapalı
          </span>
        ) : (
          <span className="absolute right-3 top-3 rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground">
            {deliverySummary(restaurant.delivery_type, Number(restaurant.delivery_fee))}
          </span>
        )}
      </div>

      <div className={compact ? "space-y-2 p-2 sm:p-3" : "space-y-3 p-4"}>
        {compact ? (
          <div className="flex min-w-0 flex-wrap gap-1 text-xs">
            <span className="min-w-0 break-words rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              {restaurant.category}
            </span>
            {!open ? (
              <span className="rounded bg-foreground/85 px-1.5 py-0.5 text-background">
                Şu An Kapalı
              </span>
            ) : null}
          </div>
        ) : null}
        {/* Çalışma saatleri afişin hemen altında, kendi satırında: bilgi
            satırının sonunda diğer rakamların arasında kaybolmuyordu. */}
        {hours ? (
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">{hours}</span>
          </p>
        ) : null}

        <div
          className={
            compact ? "flex flex-col items-start gap-1.5" : "flex items-start justify-between gap-3"
          }
        >
          <div
            className={
              compact
                ? "flex min-w-0 w-full items-start gap-1.5"
                : "flex min-w-0 items-center gap-3"
            }
          >
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={`${restaurant.name} logosu`}
                loading="lazy"
                width={40}
                height={40}
                className={`${compact ? "hidden size-7 sm:block" : "size-10"} shrink-0 rounded-full border border-border/70 bg-card object-cover`}
              />
            ) : null}
            <div className="min-w-0">
              <h3
                className={
                  compact
                    ? "break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere]"
                    : "truncate text-base font-semibold"
                }
              >
                {restaurant.name}
              </h3>
              <p
                className={`mt-0.5 line-clamp-1 text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}
              >
                {restaurant.tagline}
              </p>
              {restaurant.matched_products?.length ? (
                <p className="mt-0.5 line-clamp-1 text-xs font-medium text-primary">
                  Aradığınız ürün: {restaurant.matched_products.join(", ")}
                </p>
              ) : null}
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-warm px-2 py-1 text-xs font-semibold text-warm-foreground">
            <Star className="size-3 fill-current" />
            {Number(restaurant.rating).toFixed(1)}
          </span>
        </div>

        <div
          className={`flex flex-wrap items-center gap-y-1 text-xs text-muted-foreground ${compact ? "gap-x-2 [overflow-wrap:anywhere]" : "gap-x-4"}`}
        >
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" /> {restaurant.delivery_minutes} dk
          </span>
          <span className="flex items-center gap-1">
            <Bike className="size-3.5" />
            {deliverySummary(restaurant.delivery_type, Number(restaurant.delivery_fee))}
          </span>
          <span>Min. {formatPrice(Number(restaurant.min_order))}</span>
        </div>

        <LocationButton
          business={restaurant}
          className="max-w-full text-xs text-muted-foreground"
        />
      </div>
    </Link>
  );
}
