import { randomUUID } from "crypto";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export type SniffedImage = {
  contentType: string;
  extension: string;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function decodeValidatedImage(
  base64: string,
  contentType: string,
  maxBytes = MAX_IMAGE_BYTES,
): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) {
    throw new Error("Görsel verisi geçersiz.");
  }

  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error("Görsel verisi geçersiz.");
  }
  if (binary.length === 0 || binary.length > maxBytes) {
    throw new Error("Görsel boyutu izin verilen sınırı aşıyor.");
  }

  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  assertImageMagic(bytes, contentType);
  return bytes;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes.slice(0, 8).every((byte, i) => byte === [137, 80, 78, 71, 13, 10, 26, 10][i])
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
}

function isGif(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const header = ascii(bytes, 0, 6);
  return header === "GIF87a" || header === "GIF89a";
}

function isBmp(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d;
}

function isIco(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0 &&
    bytes[1] === 0 &&
    (bytes[2] === 1 || bytes[2] === 2) &&
    bytes[3] === 0
  );
}

function ftypBrand(bytes: Uint8Array): string {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== "ftyp") return "";
  return ascii(bytes, 8, 4).toLowerCase();
}

function isAvif(bytes: Uint8Array): boolean {
  return ["avif", "avis"].includes(ftypBrand(bytes));
}

function isHeif(bytes: Uint8Array): boolean {
  return ["heic", "heix", "heif", "heis", "mif1", "msf1"].includes(ftypBrand(bytes));
}

function sniffRasterImage(bytes: Uint8Array): SniffedImage | null {
  if (isPng(bytes)) return { contentType: "image/png", extension: "png" };
  if (isJpeg(bytes)) return { contentType: "image/jpeg", extension: "jpg" };
  if (isWebp(bytes)) return { contentType: "image/webp", extension: "webp" };
  if (isGif(bytes)) return { contentType: "image/gif", extension: "gif" };
  if (isAvif(bytes)) return { contentType: "image/avif", extension: "avif" };
  if (isBmp(bytes)) return { contentType: "image/bmp", extension: "bmp" };
  if (isIco(bytes)) return { contentType: "image/x-icon", extension: "ico" };
  return null;
}

function sanitizeSvgBytes(bytes: Uint8Array, maxBytes: number): Uint8Array {
  let text: string;
  try {
    text = new TextDecoder().decode(bytes);
  } catch {
    throw new Error("SVG verisi geçersiz.");
  }
  if (
    text.length === 0 ||
    text.length > maxBytes ||
    !/<svg[\s>]/i.test(text) ||
    /<script[\s>]|on[a-z]+\s*=|javascript:|data:text\/html|<foreignObject/i.test(text)
  ) {
    throw new Error("Güvenli olmayan SVG reddedildi.");
  }
  return Uint8Array.from(new TextEncoder().encode(text));
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, Math.min(bytes.length, 512)));
  return /<svg[\s>]/i.test(head) || /<\?xml[\s\S]{0,200}<svg[\s>]/i.test(head);
}

/** Detects PNG, JPEG, WebP, GIF, AVIF, BMP, ICO, SVG from file bytes. */
export function prepareAdImageBytes(
  bytes: Uint8Array,
  maxBytes: number,
): { bytes: Uint8Array; contentType: string; extension: string } {
  if (bytes.length === 0 || bytes.length > maxBytes) {
    throw new Error("Görsel boyutu izin verilen sınırı aşıyor.");
  }
  if (isHeif(bytes)) {
    throw new Error("HEIC/HEIF tarayıcıda açılamaz. PNG, JPEG, WebP, GIF veya AVIF kullanın.");
  }
  const raster = sniffRasterImage(bytes);
  if (raster) return { bytes, contentType: raster.contentType, extension: raster.extension };
  if (looksLikeSvg(bytes)) {
    return {
      bytes: sanitizeSvgBytes(bytes, maxBytes),
      contentType: "image/svg+xml",
      extension: "svg",
    };
  }
  throw new Error("Desteklenmeyen görsel formatı");
}

function assertImageMagic(bytes: Uint8Array, contentType: string): void {
  const valid =
    (contentType === "image/png" && isPng(bytes)) ||
    ((contentType === "image/jpeg" || contentType === "image/jpg") && isJpeg(bytes)) ||
    (contentType === "image/webp" && isWebp(bytes)) ||
    (contentType === "image/gif" && isGif(bytes)) ||
    (contentType === "image/avif" && isAvif(bytes)) ||
    (contentType === "image/bmp" && isBmp(bytes)) ||
    ((contentType === "image/x-icon" || contentType === "image/vnd.microsoft.icon") && isIco(bytes));
  if (!valid) throw new Error("Görsel içeriği türüyle eşleşmiyor.");
}

export function decodeValidatedBrandImage(base64: string, contentType: string): Uint8Array {
  if (contentType !== "image/svg+xml") {
    return decodeValidatedImage(base64, contentType, 2 * 1024 * 1024);
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) {
    throw new Error("Görsel verisi geçersiz.");
  }

  let text: string;
  try {
    text = new TextDecoder().decode(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)));
  } catch {
    throw new Error("SVG verisi geçersiz.");
  }
  if (
    text.length === 0 ||
    text.length > 2 * 1024 * 1024 ||
    !/<svg[\s>]/i.test(text) ||
    /<script[\s>]|on[a-z]+\s*=|javascript:|data:text\/html|<foreignObject/i.test(text)
  ) {
    throw new Error("Güvenli olmayan SVG reddedildi.");
  }
  return Uint8Array.from(new TextEncoder().encode(text));
}

/** Base64 görseli ilgili kovaya yükler ve herkese açık proxy adresini döner. */
export async function uploadRestaurantImage(input: {
  bucket: "product-images" | "business-images";
  restaurantId: string;
  fileName: string;
  contentType: string;
  base64: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const extension = EXTENSIONS[input.contentType] ?? "png";
  const safeName = `${randomUUID()}.${extension}`;
  const path = `${input.restaurantId}/${safeName}`;
  const binary = decodeValidatedImage(input.base64, input.contentType);

  const { error } = await supabaseAdmin.storage
    .from(input.bucket)
    .upload(path, binary, { contentType: input.contentType, upsert: false });
  if (error) throw new Error(error.message);

  return { path, url: `/api/public/media/${input.bucket}/${path}` };
}

/** Depolamadan görseli siler; başarısızlık kaydı engellemez. */
export async function removeRestaurantImage(
  bucket: "product-images" | "business-images",
  path: string | null,
) {
  if (!path) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.storage.from(bucket).remove([path]);
}
