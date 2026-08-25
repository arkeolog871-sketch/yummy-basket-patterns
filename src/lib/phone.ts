/** İşletme telefonunu `tel:` bağlantısına çevirir. Geçersizse null. */
export function toTelHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let compact = raw.trim().replace(/[^\d+]/g, "");
  if (!compact) return null;
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;

  const digits = compact.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;

  if (compact.startsWith("+")) return `tel:+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `tel:+90${digits.slice(1)}`;
  if (digits.length === 10) return `tel:+90${digits}`;
  return `tel:+${digits}`;
}

/** `tel:` içine konacak rakamlar (+ dahil). */
export function toTelNumber(raw: string | null | undefined): string | null {
  const href = toTelHref(raw);
  return href ? href.slice("tel:".length) : null;
}

export { openTelHref } from "@/lib/ios";

/** Ekranda gösterilecek Türkiye formatı; uymuyorsa orijinal metin. */
export function formatPhoneDisplay(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  const local =
    digits.length === 11 && digits.startsWith("0")
      ? digits
      : digits.length === 12 && digits.startsWith("90")
        ? `0${digits.slice(2)}`
        : digits.length === 10
          ? `0${digits}`
          : null;
  if (local && local.length === 11) {
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 9)} ${local.slice(9)}`;
  }
  return trimmed;
}
