/** Tarayıcıda (canvas ile) görsel küçültme — hem yeni yükleme akışında
 * (bkz. ImageDropzone.tsx) hem de daha önce büyük boyutta yüklenmiş
 * görselleri geriye dönük küçültmek için kullanılır (bkz. founder
 * "Görselleri küçült" aracı). En fazla `MAX_DIMENSION` kenara küçültür;
 * şeffaflığı olan görseller PNG, geri kalanı JPEG olarak yeniden kodlanır.
 * Herhangi bir adım başarısız olursa veya küçültme kazanç sağlamazsa
 * `null` döner (çağıran orijinali kullanmaya devam eder). */
export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.82;

async function hasTransparency(canvas: HTMLCanvasElement): Promise<boolean> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { width, height } = canvas;
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 10000)));
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha !== undefined && alpha < 250) return true;
    }
  }
  return false;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function shrinkImage(
  source: Blob,
  contentType: string,
): Promise<{ blob: Blob; contentType: string } | null> {
  if (contentType === "image/avif") return null; // canvas re-encode desteği tutarsız, orijinali koru
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (scale === 1 && contentType === "image/jpeg") return null; // zaten küçük bir JPEG, dokunma

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const keepsAlpha = contentType !== "image/jpeg" && (await hasTransparency(canvas));
    const outputType = keepsAlpha ? "image/png" : "image/jpeg";
    const blob = await canvasToBlob(
      canvas,
      outputType,
      outputType === "image/jpeg" ? JPEG_QUALITY : undefined,
    );
    if (!blob || blob.size >= source.size) return null; // küçültme işe yaramadıysa orijinali koru
    return { blob, contentType: outputType };
  } finally {
    bitmap.close();
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 8192) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
  }
  return btoa(binary);
}
