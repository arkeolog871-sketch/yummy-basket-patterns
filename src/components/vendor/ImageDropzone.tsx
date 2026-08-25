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

export async function readImageFile(file: File): Promise<PickedImage> {
  const contentType = mimeOf(file);
  if (!ALLOWED.includes(contentType)) {
    throw new Error("Yalnızca PNG, JPG, WEBP veya AVIF görseller yüklenebilir.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Görsel boyutu en fazla 4 MB olabilir.");
  }
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 8192) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
  }
  return {
    fileName: file.name || "kamera.jpg",
    contentType,
    base64: btoa(binary),
    previewUrl: URL.createObjectURL(file),
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
