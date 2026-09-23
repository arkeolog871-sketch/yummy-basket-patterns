/** Tarayıcıda (canvas ile) görsel küçültme — hem yeni yükleme akışında
 * (bkz. ImageDropzone.tsx) hem de daha önce büyük boyutta yüklenmiş
 * görselleri geriye dönük küçültmek için kullanılır (bkz. founder
 * "Görselleri küçült" aracı). En fazla `MAX_DIMENSION` kenara küçültür;
 * şeffaflığı olan görseller PNG, geri kalanı JPEG olarak yeniden kodlanır.
 * Herhangi bir adım başarısız olursa veya küçültme kazanç sağlamazsa
 * `null` döner (çağıran orijinali kullanmaya devam eder). */
export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.82;

/**
 * Görselin gösterildiği yere göre en uzun kenar (3x ekran payıyla).
 * ÖLÇÜLDÜ (canlı, 23 Eylül 2026): ana sayfa ilk açılışta 7,3 MB indiriyordu;
 * 6,4 MB'ı görseldi. Med Kuaför logosu 1600×1600 ve 1,4 MB iken 40×40
 * gösteriliyordu; reklamlar 1600×900 iken 293×165 gösteriliyordu.
 *  - logo: kartta 40, işletme sayfasında 56 piksel;
 *  - ürün: menü satırında küçük, ayrıntıda telefon genişliği;
 *  - kapak ve reklam: kartta ~360–550, işletme sayfasında en çok ~1150;
 *  - galeri: tam ekran büyütülebiliyor.
 */
export const MEDIA_MAX_DIMENSION = {
  logo: 320,
  product: 1000,
  cover: 1200,
  banner: 1200,
  gallery: 1600,
} as const;
export type MediaUse = keyof typeof MEDIA_MAX_DIMENSION;

/** Bu yoğunluğun (bayt/piksel) üstündeki JPEG yüksek kalitede kaydedilmiştir;
 * boyutu uygun olsa da 0.82 kaliteyle yeniden kodlanır (1600×1600, 1,4 MB =
 * 0,57 bayt/piksel idi; 0.82 kalite genelde 0,15–0,25). */
const JPEG_REENCODE_BYTES_PER_PIXEL = 0.35;

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
  maxDimension: number = MAX_DIMENSION,
): Promise<{ blob: Blob; contentType: string } | null> {
  if (contentType === "image/avif") return null; // canvas re-encode desteği tutarsız, orijinali koru
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const bytesPerPixel = source.size / (bitmap.width * bitmap.height);
    if (
      scale === 1 &&
      contentType === "image/jpeg" &&
      bytesPerPixel <= JPEG_REENCODE_BYTES_PER_PIXEL
    ) {
      return null; // zaten küçük ve makul sıkıştırılmış bir JPEG, dokunma
    }

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

const SHRINKABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Seçilen dosyayı gösterileceği yere göre küçültür; küçültülemiyorsa
 * (video, SVG, ICO, GIF, kazanç yok, tarayıcı desteklemiyor) aynen döner.
 * Reklam ve marka yüklemeleri eskiden hiç küçültülmüyordu: canlıdaki eski
 * banner 2 MB PNG idi.
 */
export async function shrinkFileForUse(file: File, use: MediaUse): Promise<File> {
  if (!SHRINKABLE_TYPES.has(file.type)) return file;
  const shrunk = await shrinkImage(file, file.type, MEDIA_MAX_DIMENSION[use]).catch(() => null);
  if (!shrunk) return file;
  const baseName = (file.name || "gorsel").replace(/\.[^.]+$/, "");
  const extension = shrunk.contentType === "image/png" ? "png" : "jpg";
  return new File([shrunk.blob], `${baseName}.${extension}`, { type: shrunk.contentType });
}
