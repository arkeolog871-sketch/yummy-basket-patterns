/** Matches nginx `client_max_body_size 30M` (30 * 1024 * 1024 bytes). */
export const MAX_AD_MEDIA_BYTES = 30 * 1024 * 1024;
export const MAX_AD_IMAGE_BYTES = MAX_AD_MEDIA_BYTES;
export const MAX_AD_IMAGE_MB = 30;

/** HTML5 playback MIME types stored on advertisement video uploads. */
export const AD_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export type AdVideoMimeType = (typeof AD_VIDEO_MIME_TYPES)[number];

const AD_VIDEO_MIME_ALIASES: readonly string[] = [
  ...AD_VIDEO_MIME_TYPES,
  "video/x-quicktime",
  "video/quicktime",
  "video/x-m4v",
];

/** OS picker: images plus MP4 / MOV / WEBM. */
export const AD_MEDIA_ACCEPT =
  "image/*,video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm";
export const AD_IMAGE_ACCEPT = AD_MEDIA_ACCEPT;

export function adImageTooLargeMessage(): string {
  return `Dosya ${MAX_AD_IMAGE_MB} MB sınırını aşıyor`;
}

export function adImageTypeRejectedMessage(): string {
  return "Yalnızca görsel veya video yükleyin (PNG, JPEG, MP4, MOV, WEBM…)";
}

export function isAdVideoMimeType(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return AD_VIDEO_MIME_ALIASES.includes(normalized);
}

export function isAdVideoUrl(url: string): boolean {
  try {
    const path = url.startsWith("http") ? new URL(url, "https://local.invalid").pathname : url;
    return /\.(mp4|mov|webm)$/i.test(path);
  } catch {
    return /\.(mp4|mov|webm)(?:$|\?)/i.test(url);
  }
}

/** Client-side gate. Empty MIME is allowed (sniffed on the server). */
export function isAdMediaFile(file: File): boolean {
  if (!file.type) return true;
  if (file.type.startsWith("image/")) return true;
  return isAdVideoMimeType(file.type);
}

export function isAdImageFile(file: File): boolean {
  return isAdMediaFile(file);
}

export function contentTypeForBrandPath(path: string, fallback = "application/octet-stream"): string {
  const clean = path.split("?")[0]?.split("#")[0] ?? path;
  const slash = clean.lastIndexOf("/");
  const file = slash === -1 ? clean : clean.slice(slash + 1);
  const dot = file.lastIndexOf(".");
  const ext = dot === -1 ? "" : file.slice(dot + 1).toLowerCase();
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "avif") return "image/avif";
  if (ext === "bmp") return "image/bmp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "ico") return "image/x-icon";
  return fallback;
}
