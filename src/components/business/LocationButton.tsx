import { MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { locationLabel, openDirections, type BusinessLocation } from "@/lib/maps";

export function LocationButton({
  business,
  className = "",
  showIcon = true,
  fallbackLabel,
}: {
  business: BusinessLocation;
  className?: string;
  showIcon?: boolean;
  fallbackLabel?: string;
}) {
  const label = locationLabel(business) ?? fallbackLabel ?? null;
  if (!label) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const opened = openDirections(business);
        if (!opened) toast.error("Bu işletme için konum bilgisi bulunamadı.");
      }}
      aria-label={`${business.name} için yol tarifi al (${label})`}
      title="Yol tarifi al"
      className={`inline-flex items-center gap-1 rounded-full underline-offset-2 transition-colors hover:text-primary hover:underline ${className}`}
    >
      {showIcon ? <MapPin className="size-3.5 shrink-0" /> : null}
      <span className="truncate">{label}</span>
      <Navigation className="size-3 shrink-0 opacity-70" />
    </button>
  );
}