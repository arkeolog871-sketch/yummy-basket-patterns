import type { MouseEvent } from "react";
import { Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhoneDisplay, toTelNumber } from "@/lib/phone";
import { openTelHref } from "@/lib/ios";
import { useSiteSettings } from "@/hooks/useSiteSettings";

function gmailComposeHref(email: string, subject: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}`;
}

export function FounderContact() {
  const { founderContact } = useSiteSettings();
  const { founder_contact_phone: phone, founder_contact_email: email } = founderContact;
  const telefonNumarasi = toTelNumber(phone);
  const telHref = telefonNumarasi ? `tel:${telefonNumarasi}` : undefined;
  const display = formatPhoneDisplay(phone);
  const mailHref = gmailComposeHref(email, "SİLVAN CEBİMDE hakkında");

  function handleCall(event: MouseEvent<HTMLAnchorElement>) {
    if (!telHref) return;
    event.preventDefault();
    openTelHref(telHref);
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16">
      <div className="rounded-3xl border border-border/70 bg-card p-6 sm:p-10">
        <div className="max-w-xl">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Sayfa yöneticisi ile iletişim
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Görüş, öneri, iş birliği veya destek talepleriniz için sayfa yöneticimize doğrudan
            ulaşabilirsiniz.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-3xl border border-primary/25 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <a
              href={telHref}
              onClick={handleCall}
              className="min-h-11 min-w-0 touch-manipulation text-foreground no-underline"
              aria-label={`Sayfa yöneticisini ara: ${display}`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Telefon
              </p>
              <p className="font-display mt-1 text-2xl font-bold leading-tight tracking-wide tabular-nums sm:text-3xl">
                {display}
              </p>
            </a>
            <Button
              asChild
              size="lg"
              className="h-12 min-h-12 shrink-0 rounded-full px-6 text-base shadow-glow"
            >
              <a
                href={telHref}
                onClick={handleCall}
                className="touch-manipulation"
                aria-label="Sayfa yöneticisini ara"
              >
                <Phone className="size-5" />
                Ara
              </a>
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-accent/25 bg-accent/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                E-posta
              </p>
              <p className="font-display mt-1 truncate text-xl font-bold leading-tight sm:text-2xl">
                {email}
              </p>
            </div>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="h-12 min-h-12 shrink-0 rounded-full px-6 text-base"
            >
              <a
                href={mailHref}
                target="_blank"
                rel="noopener noreferrer"
                className="touch-manipulation"
                aria-label="Sayfa yöneticisine e-posta gönder"
              >
                <Mail className="size-5" />
                E-posta gönder
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
