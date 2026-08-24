import {
  adImageTooLargeMessage,
  adImageTypeRejectedMessage,
  contentTypeForBrandPath,
  isAdMediaFile,
  isAdVideoUrl,
  MAX_AD_MEDIA_BYTES,
} from "@/lib/upload-limits";
import type { PublicBanner } from "@/lib/advertisements";

export const SIM_IMAGE_URL = "/sim/banner.jpg";
export const SIM_VIDEO_URL = "/sim/banner.mp4";

export function simulationBanners(): PublicBanner[] {
  return [
    {
      id: "sim-image",
      title: "Örnek görsel reklam",
      image_url: SIM_IMAGE_URL,
      action_type: "internal_route",
      action_value: "/restoranlar",
      display_order: 0,
    },
    {
      id: "sim-video",
      title: "Örnek video reklam (MP4)",
      image_url: SIM_VIDEO_URL,
      action_type: "phone",
      action_value: "+905551112233",
      display_order: 1,
    },
  ];
}

export function simulateAdDisplay(url: string): { element: "img" | "video"; type?: string } {
  if (isAdVideoUrl(url)) return { element: "video", type: contentTypeForBrandPath(url) };
  return { element: "img" };
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function ftypBrand(bytes: Uint8Array): string {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== "ftyp") return "";
  return ascii(bytes, 8, 4).toLowerCase();
}

function sniffKind(bytes: Uint8Array): { kind: "image" | "video"; contentType: string } | { error: string } | null {
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "%PDF") {
    return { error: adImageTypeRejectedMessage() };
  }
  const brand = ftypBrand(bytes);
  if (["heic", "heix", "heif", "heis", "mif1", "msf1"].includes(brand)) {
    return { error: "HEIC/HEIF tarayıcıda açılamaz. PNG, JPEG, WebP, GIF, AVIF, MP4, MOV veya WEBM kullanın." };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { kind: "image", contentType: "image/jpeg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71
  ) {
    return { kind: "image", contentType: "image/png" };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { kind: "image", contentType: "image/webp" };
  }
  const gif = bytes.length >= 6 ? ascii(bytes, 0, 6) : "";
  if (gif === "GIF87a" || gif === "GIF89a") return { kind: "image", contentType: "image/gif" };
  if (["avif", "avis"].includes(brand)) return { kind: "image", contentType: "image/avif" };
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { kind: "image", contentType: "image/bmp" };
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { kind: "video", contentType: "video/webm" };
  }
  if (brand === "qt  ") return { kind: "video", contentType: "video/quicktime" };
  if (brand) return { kind: "video", contentType: "video/mp4" };
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, Math.min(bytes.length, 512)));
  if (/<svg[\s>]/i.test(head)) return { kind: "image", contentType: "image/svg+xml" };
  return null;
}

export type SimUploadOk = {
  ok: true;
  kind: "image" | "video";
  previewUrl: string;
  contentType: string;
  fileName: string;
  size: number;
  display: "img" | "video";
};

export type SimUploadResult = SimUploadOk | { ok: false; error: string };

export async function simulateAdUpload(file: File): Promise<SimUploadResult> {
  if (file.size === 0) return { ok: false, error: "Görsel veya video seçin" };
  if (file.size > MAX_AD_MEDIA_BYTES) return { ok: false, error: adImageTooLargeMessage() };
  if (!isAdMediaFile(file)) return { ok: false, error: adImageTypeRejectedMessage() };

  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const sniffed = sniffKind(head);
  if (sniffed && "error" in sniffed) return { ok: false, error: sniffed.error };
  if (!sniffed) return { ok: false, error: adImageTypeRejectedMessage() };

  return {
    ok: true,
    kind: sniffed.kind,
    previewUrl: URL.createObjectURL(file),
    contentType: sniffed.contentType,
    fileName: file.name,
    size: file.size,
    display: sniffed.kind === "video" ? "video" : "img",
  };
}

export function formatSimBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
