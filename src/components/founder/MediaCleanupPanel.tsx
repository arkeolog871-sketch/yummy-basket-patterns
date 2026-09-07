import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImageDown, Loader2 } from "lucide-react";
import { toPublicErrorMessage } from "@/lib/public-error";
import { shrinkImage, blobToBase64 } from "@/lib/image-resize";
import {
  listResizableMedia,
  reprocessMediaFile,
  type ResizableMediaFile,
} from "@/lib/media-maintenance.functions";
import { Button } from "@/components/ui/button";

type LogLine = { path: string; status: "ok" | "skip" | "error"; detail: string };

function formatKb(bytes: number) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/** Görsel küçültme yalnızca yeni yüklemelerde devreye giriyor (bkz.
 * ImageDropzone.tsx); bu araç daha önce büyük boyutta yüklenmiş dosyaları
 * tek seferlik olarak tarayıcıda küçültüp aynı depolama yoluna geri yükler. */
export function MediaCleanupPanel() {
  const listFn = useServerFn(listResizableMedia);
  const reprocessFn = useServerFn(reprocessMediaFile);
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["resizable-media"], queryFn: () => listFn() });
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [doneCount, setDoneCount] = useState(0);

  const files = list.data ?? [];
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  async function processOne(file: ResizableMediaFile): Promise<LogLine> {
    try {
      const response = await fetch(file.url);
      if (!response.ok) return { path: file.path, status: "error", detail: "indirilemedi" };
      const blob = await response.blob();
      const contentType = blob.type || "image/jpeg";
      const shrunk = await shrinkImage(blob, contentType);
      if (!shrunk) return { path: file.path, status: "skip", detail: "zaten küçük" };

      const base64 = await blobToBase64(shrunk.blob);
      await reprocessFn({
        data: { bucket: file.bucket, path: file.path, contentType: shrunk.contentType, base64 },
      });
      const pct = Math.round((1 - shrunk.blob.size / file.size) * 100);
      return {
        path: file.path,
        status: "ok",
        detail: `${formatKb(file.size)} → ${formatKb(shrunk.blob.size)} (-%${pct})`,
      };
    } catch (error) {
      return { path: file.path, status: "error", detail: toPublicErrorMessage(error) };
    }
  }

  async function runAll() {
    setRunning(true);
    setLog([]);
    setDoneCount(0);
    for (const file of files) {
      const line = await processOne(file);
      setLog((current) => [...current, line]);
      setDoneCount((count) => count + 1);
    }
    setRunning(false);
    toast.success("Görsel küçültme tamamlandı");
    void queryClient.invalidateQueries({ queryKey: ["resizable-media"] });
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <ImageDown className="size-4 text-accent" />
        <h2 className="text-xl">Mevcut görselleri küçült</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Yeni yüklenen görseller artık otomatik küçültülüyor. Bu araç, bu değişiklikten önce
        yüklenmiş dosyaları (işletme/ürün görselleri, reklam banner'ları) taşımadan aynı adreste
        küçültür — hiçbir kayıt güncellenmesi gerekmez.
      </p>

      {list.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : list.isError ? (
        <p className="mt-4 text-sm text-destructive">Liste alınamadı.</p>
      ) : files.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Küçültülecek görsel kalmamış.</p>
      ) : (
        <>
          <p className="mt-4 text-sm">
            <span className="font-semibold">{files.length}</span> dosya, toplam{" "}
            <span className="font-semibold">{(totalBytes / 1024 / 1024).toFixed(1)} MB</span>
          </p>
          <Button className="mt-3 rounded-full" disabled={running} onClick={() => void runAll()}>
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin" /> İşleniyor… ({doneCount}/{files.length})
              </>
            ) : (
              "Küçültmeyi başlat"
            )}
          </Button>
        </>
      )}

      {log.length > 0 ? (
        <div className="mt-4 max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-border bg-muted/40 p-3 text-xs">
          {log.map((line, index) => (
            <p
              key={`${line.path}-${index}`}
              className={
                line.status === "error"
                  ? "text-destructive"
                  : line.status === "skip"
                    ? "text-muted-foreground"
                    : "text-foreground"
              }
            >
              {line.status === "ok" ? "✓" : line.status === "skip" ? "–" : "✗"} {line.path} —{" "}
              {line.detail}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
