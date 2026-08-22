export type BusinessHours = {
  opens_at?: string | null;
  closes_at?: string | null;
  is_open_manual?: boolean | null;
};

/** "09:30:00" | "09:30" -> 570 */
export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function formatTime(value: string | null | undefined): string | null {
  const total = timeToMinutes(value);
  if (total === null) return null;
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Türkiye saatine göre günün dakika değeri. */
export function localNowMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const minutes = timeToMinutes(parts);
  if (minutes === null) return 0;
  return minutes >= 24 * 60 ? minutes % (24 * 60) : minutes;
}

/** Saat aralığı gece yarısını aşabilir (örn. 18:00 - 02:00). */
export function isWithinHours(business: BusinessHours, now?: Date): boolean {
  const open = timeToMinutes(business.opens_at);
  const close = timeToMinutes(business.closes_at);
  if (open === null || close === null || open === close) return true;
  const current = localNowMinutes(now);
  return close > open ? current >= open && current < close : current >= open || current < close;
}

/** Manuel anahtar kapalıysa veya saat aralığı dışındaysa işletme kapalıdır. */
export function isBusinessOpen(business: BusinessHours, now?: Date): boolean {
  if (business.is_open_manual === false) return false;
  return isWithinHours(business, now);
}

export function hoursLabel(business: BusinessHours): string | null {
  const open = formatTime(business.opens_at);
  const close = formatTime(business.closes_at);
  if (!open || !close) return null;
  return `${open} - ${close}`;
}

export function closedReason(business: BusinessHours, now?: Date): string {
  if (business.is_open_manual === false) return "İşletme siparişleri geçici olarak durdurdu.";
  const label = hoursLabel(business);
  return label
    ? `Şu an kapalı. Çalışma saatleri: ${label}.`
    : "İşletme şu anda sipariş almıyor.";
}
