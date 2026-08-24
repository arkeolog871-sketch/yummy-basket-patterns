import { useEffect, useRef, useState } from "react";
import { ImageUp, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { HeroBannerSlider } from "@/components/home/HeroBannerSlider";
import { AdMedia } from "@/components/home/AdMedia";
import {
  formatSimBytes,
  simulateAdUpload,
  simulationBanners,
  type SimUploadOk,
} from "@/lib/ad-simulation";
import { AD_MEDIA_ACCEPT, MAX_AD_IMAGE_MB } from "@/lib/upload-limits";
import type { PublicBanner } from "@/lib/advertisements";
import { Button } from "@/components/ui/button";

type LogLine = { at: string; text: string; ok: boolean };

function stamp(): string {
  return new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function AdSimulationStudio() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = useRef<string>("");
  const [uploaded, setUploaded] = useState<SimUploadOk | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  function log(text: string, ok = true) {
    setLogs((prev) => [{ at: stamp(), text, ok }, ...prev].slice(0, 12));
  }

  async function onPick(file: File) {
    const result = await simulateAdUpload(file);
    if (!result.ok) {
      log(`Reddedildi: ${result.error}`, false);
      toast.error(result.error);
      return;
    }
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = result.previewUrl;
    setUploaded(result);
    log(
      `Yüklendi (yerel): ${result.fileName} · ${formatSimBytes(result.size)} · ${result.contentType} · gösterim <${result.display}>`,
    );
    toast.success(result.kind === "video" ? "Video slayt olarak önizlendi" : "Görsel slayt olarak önizlendi");
  }

  const sample = simulationBanners();
  const localSlide: PublicBanner[] = uploaded
    ? [
        {
          id: "sim-local",
          title: uploaded.fileName,
          image_url: uploaded.previewUrl,
          action_type: "internal_route",
          action_value: "/",
          display_order: 0,
        },
      ]
    : [];

  return (
    <div className="space-y-6" data-ad-simulation-studio="">
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 text-accent" />
          <h2 className="text-lg font-semibold">Ana sayfa görüntüleme</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          JPEG slayt + sessiz döngülü MP4. Tıklama gerçek telefon/rota açmaz; yalnızca simüle edilir.
        </p>
        <div className="mt-4">
          <HeroBannerSlider
            banners={sample}
            simulation
            onActivate={(banner) => log(`Tıklama: ${banner.title} → ${banner.action_type} ${banner.action_value}`)}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Yükleme simülasyonu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dosya cihazınızda kalır; Storage’a gitmez. PNG, JPEG, WebP, GIF, AVIF, SVG, MP4, MOV, WEBM · en fazla{" "}
          {MAX_AD_IMAGE_MB} MB. PDF ve HEIC reddedilir.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept={AD_MEDIA_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void onPick(file);
          }}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" className="rounded-full" onClick={() => fileRef.current?.click()}>
            <ImageUp className="size-4" />
            Dosya seç
          </Button>
          {uploaded ? (
            <span className="text-sm text-muted-foreground">
              {uploaded.fileName} · {formatSimBytes(uploaded.size)}
            </span>
          ) : null}
        </div>

        {uploaded ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <div className="h-20 w-32 overflow-hidden rounded-xl border bg-muted">
              <AdMedia src={uploaded.previewUrl} className="size-full object-cover" active priority />
            </div>
            <HeroBannerSlider
              banners={localSlide}
              simulation
              onActivate={() => log(`Yerel önizleme tıklandı (${uploaded.display})`)}
            />
          </div>
        ) : null}

        {logs.length > 0 ? (
          <ol className="mt-4 space-y-1.5 font-mono text-[11px] leading-relaxed" aria-live="polite">
            {logs.map((line, i) => (
              <li key={`${line.at}-${i}`} className={line.ok ? "text-muted-foreground" : "text-destructive"}>
                <span className="opacity-70">{line.at}</span> {line.text}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Henüz yükleme yok. Bir görsel veya video seçin.</p>
        )}
      </section>
    </div>
  );
}
