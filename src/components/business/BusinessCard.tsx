import { Star, Clock, Bike } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { LocationButton } from "@/components/business/LocationButton";
import type { BusinessCardData } from "@/lib/sectors";

export function BusinessCard({ business }: { business: BusinessCardData }) {
  const deliverable = business.deliveryMinutes > 0;

  return (
    <article className="group overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-lifted">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={business.image}
          alt={`${business.name} — ${business.tagline}`}
          loading="lazy"
          width={1024}
          height={640}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {business.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold">
            {business.badge}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{business.name}</h3>
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{business.tagline}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-warm px-2 py-1 text-xs font-semibold text-warm-foreground">
            <Star className="size-3 fill-current" />
            {business.rating.toFixed(1)}
            <span className="font-normal opacity-70">({business.reviewCount})</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {business.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <LocationButton business={{ name: business.name, district: business.district }} />
          {deliverable ? (
            <>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" /> {business.deliveryMinutes} dk
              </span>
              <span className="flex items-center gap-1">
                <Bike className="size-3.5" />
                {business.deliveryFee === 0 ? "Ücretsiz" : formatPrice(business.deliveryFee)}
              </span>
              <span>Min. {formatPrice(business.minOrder)}</span>
            </>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" /> Yerinde / rezervasyon
            </span>
          )}
        </div>
      </div>
    </article>
  );
}