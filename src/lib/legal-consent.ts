/** Kullanım Koşulları için yeniden kabul gerekli mi? (saf, test edilebilir) */
export function termsReacceptanceRequired(
  lastAcceptedVersion: number | null,
  activeVersion: number,
): boolean {
  if (lastAcceptedVersion === null) return true;
  return lastAcceptedVersion < activeVersion;
}

/** Gönderim yalnız kutu işaretliyse serbest. */
export function canSubmitWithTerms(termsChecked: boolean): boolean {
  return termsChecked === true;
}
