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

/** OS / gallery picker: all images and videos. */
export const AD_MEDIA_ACCEPT = "image/*,video/*";
export const AD_IMAGE_ACCEPT = AD_MEDIA_ACCEPT;

export const BANNERS_BUCKET = "banners";

const AD_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-quicktime": "mov",
  "video/x-m4v": "mp4",
};

const AD_ALLOWED_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "avif",
  "bmp",
  "svg",
  "ico",
  "heic",
  "heif",
  "mp4",
  "mov",
  "webm",
]);

/** Gallery file → storage object extension. */
export function extensionForAdMediaFile(file: File): string | null {
  const base = file.name.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
  if (AD_ALLOWED_EXT.has(ext)) return ext === "jpeg" ? "jpg" : ext;
  const fromMime = AD_EXT_BY_MIME[file.type.trim().toLowerCase()];
  return fromMime ?? null;
}

export function adImageTooLargeMessage(): string {
  return `Dosya ${MAX_AD_IMAGE_MB} MB sınırını aşıyor`;
}

export function adImageTypeRejectedMessage(): string {
  return "Yalnızca görsel veya video yükleyin (PNG, JPEG, MP4, MOV, WEBM…)";
}

export function adStorageUploadErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error != null && "message" in error
        ? String((error as Record<string, unknown>)["message"] ?? "")
        : String(error ?? "");
  const lower = raw.toLowerCase();
  if (
    lower.includes("nosuchbucket") ||
    lower.includes("bucket not found") ||
    (lower.includes("bucket") && lower.includes("not found"))
  ) {
    return "banners kovası henüz yok. Kurulum SQL’sinin tamamını (storage.buckets satırları dahil) SQL Editor’da çalıştırın.";
  }
  if (lower.includes("row-level security") || lower.includes("403") || lower.includes("unauthorized")) {
    return "Yükleme yetkisi yok. Kurucu hesabıyla giriş yapın; SQL’deki banners politikaları çalışmış olmalı.";
  }
  if (lower.includes("mime") || lower.includes("not allowed") || lower.includes("invalid content")) {
    return "Bu dosya türü kovada izinli değil. JPEG, PNG, MP4, MOV veya WEBM deneyin.";
  }
  if (lower.includes("payload") || lower.includes("too large") || lower.includes("maximum")) {
    return adImageTooLargeMessage();
  }
  return raw.trim() || "Dosya yüklenemedi";
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

/** Client-side gate. Empty MIME is allowed; extension is required before upload. */
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
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return fallback;
}
