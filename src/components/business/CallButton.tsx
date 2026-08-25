import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhoneDisplay, toTelNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

export function CallButton({
  phone,
  businessName,
  className,
}: {
  phone: string | null | undefined;
  businessName: string;
  className?: string;
}) {
  const telefonNumarasi = toTelNumber(phone);
  if (!telefonNumarasi || !phone) return null;
  const display = formatPhoneDisplay(phone);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-3xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5",
        className,
      )}
    >
      <a
        href={`tel:${telefonNumarasi}`}
        className="min-w-0 text-foreground no-underline"
        aria-label={`${businessName} numarasını ara: ${display}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Telefon
        </p>
        <p className="font-display mt-1 text-3xl font-bold leading-tight tracking-wide tabular-nums sm:text-4xl">
          {display}
        </p>
      </a>
      <Button asChild size="lg" className="h-12 shrink-0 rounded-full px-6 text-base shadow-glow">
        <a href={`tel:${telefonNumarasi}`} aria-label={`${businessName} işletmesini ara`}>
          <Phone className="size-5" />
          Ara
        </a>
      </Button>
    </div>
  );
}
