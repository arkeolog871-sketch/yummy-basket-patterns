/** Telefonu karşılaştırma için son 10 haneye indirger (0 / +90 farkı önemsizdir). */
export function phoneKey(input: string | null | undefined): string {
  const digits = (input ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Aynı hesaptan açılan her işletmenin telefonu farklı olmalı; dolu ve eşleşen numara çakışmadır. */
export function isPhoneTaken(
  phone: string,
  existing: ReadonlyArray<string | null | undefined>,
): boolean {
  const key = phoneKey(phone);
  if (key.length < 10) return false;
  return existing.some((value) => phoneKey(value) === key);
}

export const DUPLICATE_BUSINESS_PHONE_ERROR =
  "Bu telefon numarası başka bir işletmede kullanılıyor. Her işletme için farklı bir telefon numarası girin.";
