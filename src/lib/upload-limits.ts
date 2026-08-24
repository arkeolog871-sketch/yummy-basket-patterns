/** Matches nginx `client_max_body_size 30M` (30 * 1024 * 1024 bytes). */
export const MAX_AD_IMAGE_BYTES = 30 * 1024 * 1024;
export const MAX_AD_IMAGE_MB = 30;

export function adImageTooLargeMessage(): string {
  return `Dosya ${MAX_AD_IMAGE_MB} MB sınırını aşıyor`;
}
