import type { MouseEvent } from "react";
import { ChevronDown, Mail, Phone } from "lucide-react";
import { formatPhoneDisplay, toTelNumber } from "@/lib/phone";
import { openTelHref } from "@/lib/ios";
import { useSiteSettings } from "@/hooks/useSiteSettings";

function gmailComposeHref(email: string, subject: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}`;
}

/**
 * Alt bilgi → Keşfet → İletişim: dokununca sayfa yöneticisinin telefonu ve
 * e-postası açılır. (Eskiden ana sayfada ayrı bir kartta duruyordu; o yer
 * işletme başvurusu çağrısına ayrıldı.) Numara ve adres kurucu panelindeki
 * iletişim ayarından gelir.
 */
export function FooterContact() {
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
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        İletişim
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-1">
        {telHref ? (
          <li>
            <a
              href={telHref}
              onClick={handleCall}
              className="flex min-h-11 touch-manipulation items-center gap-2 tabular-nums transition-colors hover:text-foreground"
              aria-label={`Sayfa yöneticisini ara: ${display}`}
            >
              <Phone className="size-4 shrink-0" />
              {display}
            </a>
          </li>
        ) : null}
        {email ? (
          <li>
            <a
              href={mailHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 touch-manipulation items-center gap-2 break-all transition-colors hover:text-foreground"
              aria-label={`Sayfa yöneticisine e-posta gönder: ${email}`}
            >
              <Mail className="size-4 shrink-0" />
              {email}
            </a>
          </li>
        ) : null}
      </ul>
    </details>
  );
}
