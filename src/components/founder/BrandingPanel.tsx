import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { ImageUp, Trash2 } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { uploadBrandAsset, removeBrandAsset } from "@/lib/branding.functions";
import { Button } from "@/components/ui/button";

type Kind = "logo" | "favicon" | "banner";

const SLOTS: { kind: Kind; title: string; hint: string; box: string }[] = [
  { kind: "logo", title: "Logo", hint: "Kare, en az 128×128 px (PNG/SVG)", box: "size-20 rounded-2xl" },
  { kind: "favicon", title: "Favicon", hint: "32×32 px, PNG veya ICO", box: "size-10 rounded-lg" },
  { kind: "banner", title: "Banner / afiş", hint: "Ana sayfa görseli, 1200×900 px", box: "h-24 w-40 rounded-2xl" },
];

const MAX_BYTES = 2 * 1024 * 1024;

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

export function BrandingPanel() {
  const { settings, refresh } = useSiteSettings();
  const upload = useServerFn(uploadBrandAsset);
  const remove = useServerFn(removeBrandAsset);
  const [busy, setBusy] = useState<Kind | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const uploadMutation = useMutation({
    mutationFn: async ({ kind, file }: { kind: Kind; file: File }) => {
      if (file.size > MAX_BYTES) throw new Error("Dosya 2 MB sınırını aşıyor");
      const base64 = await toBase64(file);
      return upload({
        data: { kind, fileName: file.name, contentType: file.type, base64 },
      });
    },
    onSuccess: () => {
      toast.success("Görsel yüklendi");
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
    onSettled: () => setBusy(null),
  });

  const removeMutation = useMutation({
    mutationFn: (kind: Kind) => remove({ data: { kind } }),
    onSuccess: () => {
      toast.success("Görsel kaldırıldı");
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  function currentUrl(kind: Kind) {
    if (kind === "logo") return settings.logo_url;
    if (kind === "favicon") return settings.favicon_url;
    return settings.banner_url;
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <h2 className="text-xl">Görsel ve logo yönetimi</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Logo, favicon ve banner görsellerini yükleyin veya kaldırın. Değişiklikler tüm siteye anında
        yansır.
      </p>

      <div className="mt-5 space-y-4">
        {SLOTS.map((slot) => {
          const url = currentUrl(slot.kind);
          return (
            <div
              key={slot.kind}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-border p-4"
            >
              <div
                className={`flex shrink-0 items-center justify-center overflow-hidden border border-border/70 bg-muted ${slot.box}`}
              >
                {url ? (
                  <img src={url} alt={`${slot.title} önizleme`} className="size-full object-cover" />
                ) : (
                  <ImageUp className="size-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{slot.title}</p>
                <p className="text-xs text-muted-foreground">{slot.hint}</p>
              </div>
              <input
                ref={(node) => {
                  inputs.current[slot.kind] = node;
                }}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setBusy(slot.kind);
                  uploadMutation.mutate({ kind: slot.kind, file });
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={busy === slot.kind}
                  onClick={() => inputs.current[slot.kind]?.click()}
                >
                  <ImageUp className="size-4" />
                  {busy === slot.kind ? "Yükleniyor…" : url ? "Değiştir" : "Yükle"}
                </Button>
                {url ? (
                  <Button
                    variant="ghost"
                    className="rounded-full"
                    aria-label={`${slot.title} kaldır`}
                    onClick={() => removeMutation.mutate(slot.kind)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}