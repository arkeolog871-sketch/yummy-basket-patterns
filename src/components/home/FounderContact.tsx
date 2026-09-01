import type { MouseEvent } from "react";
import { Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhoneDisplay, toTelNumber } from "@/lib/phone";
import { openTelHref } from "@/lib/ios";

const FOUNDER_NAME = "İsmail Simpil";
const FOUNDER_PHONE = "0546 696 31 33";
const FOUNDER_EMAIL = "arkeolog871@gmail.com";

function gmailComposeHref(email: string, subject: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}`;
}

export function FounderContact() {
  const telefonNumarasi = toTelNumber(FOUNDER_PHONE);
  const telHref = telefonNumarasi ? `tel:${telefonNumarasi}` : undefined;
  const display = formatPhoneDisplay(FOUNDER_PHONE);
  const mailHref = gmailComposeHref(FOUNDER_EMAIL, "SİLVAN CEBİMDE hakkında");

  function handleCall(event: MouseEvent<HTMLAnchorElement>) {
    if (!telHref) return;
    event.preventDefault();
    openTelHref(telHref);
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16">
      <div className="rounded-3xl border border-border/70 bg-card p-6 sm:p-10">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Kurucu ile iletişim
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl">{FOUNDER_NAME}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Görüş, öneri, iş birliği veya destek talepleriniz için kurucumuza doğrudan
            ulaşabilirsiniz.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-3xl border border-primary/25 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <a
              href={telHref}
              onClick={handleCall}
              className="min-h-11 min-w-0 touch-manipulation text-foreground no-underline"
              aria-label={`Kurucuyu ara: ${display}`}
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
                aria-label="Kurucuyu ara"
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
                {FOUNDER_EMAIL}
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
                aria-label="Kurucuya e-posta gönder"
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
