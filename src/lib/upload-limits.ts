/** Matches nginx `client_max_body_size 30M` (30 * 1024 * 1024 bytes). */
export const MAX_AD_IMAGE_BYTES = 30 * 1024 * 1024;
export const MAX_AD_IMAGE_MB = 30;

/** OS file picker: any image the device reports. Server sniffs the real format. */
export const AD_IMAGE_ACCEPT = "image/*";

export function adImageTooLargeMessage(): string {
  return `Dosya ${MAX_AD_IMAGE_MB} MB sınırını aşıyor`;
}

export function adImageTypeRejectedMessage(): string {
  return "Yalnızca görsel dosyası yükleyin";
}

/** Client-side gate: reject obvious non-images. Empty MIME is allowed (sniffed on the server). */
export function isAdImageFile(file: File): boolean {
  return !file.type || file.type.startsWith("image/");
}
