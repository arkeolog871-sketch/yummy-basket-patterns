import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PickedImage = {
  fileName: string;
  contentType: string;
  base64: string;
  previewUrl: string;
};

const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif"];
const MAX_BYTES = 4 * 1024 * 1024;

function mimeOf(file: File): string {
  const type = file.type.trim().toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  if (ALLOWED.includes(type)) return type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".avif")) return "image/avif";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return type;
}

/** Sayfa/görsel yüklemesini hızlandırmak için telefon kameralarından gelen
 * (genelde 3000px+ kenarlı) fotoğrafları yüklemeden önce küçültür. Şeffaflığı
 * olan PNG/WebP'ler şeffaf kalsın diye PNG olarak, geri kalanı (fotoğraflar)
 * çok daha küçük JPEG olarak yeniden kodlanır. Herhangi bir adım
 * başarısız olursa orijinal dosya değişmeden kullanılır. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

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

async function shrinkImage(
  file: File,
  contentType: string,
): Promise<{ blob: Blob; contentType: string } | null> {
  if (contentType === "image/avif") return null; // canvas re-encode desteği tutarsız, orijinali koru
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
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
    if (!blob || blob.size >= file.size) return null; // küçültme işe yaramadıysa orijinali koru
    return { blob, contentType: outputType };
  } finally {
    bitmap.close();
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 8192) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export async function readImageFile(file: File): Promise<PickedImage> {
  const contentType = mimeOf(file);
  if (!ALLOWED.includes(contentType)) {
    throw new Error("Yalnızca PNG, JPG, WEBP veya AVIF görseller yüklenebilir.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Görsel boyutu en fazla 4 MB olabilir.");
  }

  const shrunk = await shrinkImage(file, contentType).catch(() => null);
  const source = shrunk?.blob ?? file;
  const finalContentType = shrunk?.contentType ?? contentType;
  const base64 = await blobToBase64(source);
  const extension = finalContentType === "image/png" ? "png" : "jpg";
  const baseName = (file.name || "kamera").replace(/\.[^.]+$/, "");

  return {
    fileName: shrunk ? `${baseName}.${extension}` : file.name || "kamera.jpg",
    contentType: finalContentType,
    base64,
    previewUrl: URL.createObjectURL(source),
  };
}

export function ImageDropzone({
  onFiles,
  multiple = false,
  busy = false,
  label = "Görseli buraya sürükleyin veya seçmek için tıklayın",
  hint = "PNG, JPG, WEBP · en fazla 4 MB",
  className,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  busy?: boolean;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function emit(list: FileList | File[] | null) {
    const files = list ? Array.from(list) : [];
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  }

  const inputs =
    mounted && typeof document !== "undefined"
      ? createPortal(
          <div className="hidden" aria-hidden="true">
            <input
              ref={galleryRef}
              type="file"
              accept={ALLOWED.join(",")}
              multiple={multiple}
              onChange={(event) => {
                emit(event.target.files);
                event.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                emit(event.target.files);
                event.target.value = "";
              }}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => galleryRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") galleryRef.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        emit(event.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/40 p-6 text-center transition-colors hover:border-primary/60 hover:bg-muted/70",
        dragging && "border-primary bg-primary/5",
        busy && "pointer-events-none opacity-70",
        className,
      )}
    >
      {inputs}
      {busy ? (
        <Loader2 className="size-5 animate-spin text-primary" />
      ) : (
        <ImagePlus className="size-5 text-muted-foreground" />
      )}
      <p className="text-sm font-medium">{busy ? "Yükleniyor…" : label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <button
        type="button"
        className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const input = cameraRef.current;
          if (!input) return;
          input.value = "";
          input.click();
        }}
      >
        <Camera className="size-3.5" />
        Kamera ile çek
      </button>
    </div>
  );
}
