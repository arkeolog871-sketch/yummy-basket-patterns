import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PickedImage = {
  fileName: string;
  contentType: string;
  base64: string;
  previewUrl: string;
};

const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif"];
const MAX_BYTES = 4 * 1024 * 1024;

export async function readImageFile(file: File): Promise<PickedImage> {
  if (!ALLOWED.includes(file.type)) {
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
    fileName: file.name,
    contentType: file.type,
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = Array.from(event.dataTransfer.files ?? []);
        if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/40 p-6 text-center transition-colors hover:border-primary/60 hover:bg-muted/70",
        dragging && "border-primary bg-primary/5",
        busy && "pointer-events-none opacity-70",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(",")}
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          event.target.value = "";
        }}
      />
      {busy ? (
        <Loader2 className="size-5 animate-spin text-primary" />
      ) : (
        <ImagePlus className="size-5 text-muted-foreground" />
      )}
      <p className="text-sm font-medium">{busy ? "Yükleniyor…" : label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
