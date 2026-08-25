import type { MouseEvent } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhoneDisplay, openTelHref, toTelNumber } from "@/lib/phone";
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
  const telHref = `tel:${telefonNumarasi}`;

  function handleCall(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    openTelHref(telHref);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-3xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5",
        className,
      )}
    >
      <a
        href={telHref}
        onClick={handleCall}
        className="min-h-11 min-w-0 touch-manipulation text-foreground no-underline"
        aria-label={`${businessName} numarasını ara: ${display}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Telefon
        </p>
        <p className="font-display mt-1 text-[1.75rem] font-bold leading-tight tracking-wide tabular-nums sm:text-4xl">
          {display}
        </p>
      </a>
      <Button asChild size="lg" className="h-12 min-h-12 shrink-0 rounded-full px-6 text-base shadow-glow">
        <a
          href={telHref}
          onClick={handleCall}
          className="touch-manipulation"
          aria-label={`${businessName} işletmesini ara`}
        >
          <Phone className="size-5" />
          Ara
        </a>
      </Button>
    </div>
  );
}
