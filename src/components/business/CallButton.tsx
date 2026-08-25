import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhoneDisplay, toTelHref } from "@/lib/phone";
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
  const href = toTelHref(phone);
  if (!href || !phone) return null;
  const display = formatPhoneDisplay(phone);

  return (
    <Button asChild size="lg" className={cn("rounded-full shadow-glow", className)}>
      <a href={href} aria-label={`${businessName} işletmesini ara: ${display}`}>
        <Phone className="size-4" />
        Ara
        <span className="font-medium tabular-nums tracking-wide">{display}</span>
      </a>
    </Button>
  );
}
