import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Copy,
  ImageUp,
  Megaphone,
  Plus,
  Save,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toPublicErrorMessage } from "@/lib/public-error";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { updateHeroBanners, uploadHeroBannerImage } from "@/lib/hero-banners.functions";
import {
  createEmptySlide,
  HERO_BANNERS_SQL,
  HERO_INTERVAL_MAX,
  HERO_INTERVAL_MIN,
  MAX_HERO_BANNERS,
  parseHeroBanners,
  type HeroBannerSlide,
  type HeroBannersSettings,
} from "@/lib/hero-banners";
import { HeroBannerSlider } from "@/components/home/HeroBannerSlider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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

export function AdsPanel() {
  const { settings, refresh, isFounder } = useSiteSettings();
  const save = useServerFn(updateHeroBanners);
  const upload = useServerFn(uploadHeroBannerImage);
  const [form, setForm] = useState<HeroBannersSettings>(() => parseHeroBanners(settings.heroBanners));
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setForm(parseHeroBanners(settings.heroBanners));
  }, [settings.heroBanners]);

  const mutation = useMutation({
    mutationFn: (values: HeroBannersSettings) => save({ data: values }),
    onSuccess: () => {
      toast.success("Reklam panosu kaydedildi");
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      if (file.size > MAX_BYTES) throw new Error("Dosya 2 MB sınırını aşıyor");
      const base64 = await toBase64(file);
      const result = (await upload({
        data: { fileName: file.name, contentType: file.type, base64 },
      })) as { url?: string };
      const url = result.url;
      if (!url) throw new Error("Görsel adresi alınamadı");
      return { id, url };
    },
    onSuccess: ({ id, url }) => {
      setForm((prev) => ({
        ...prev,
        slides: prev.slides.map((slide) => (slide.id === id ? { ...slide, imageUrl: url } : slide)),
      }));
      toast.success("Görsel yüklendi — kaydetmeyi unutmayın");
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
    onSettled: () => setBusyId(null),
  });

  function patchSlide(id: string, partial: Partial<HeroBannerSlide>) {
    setForm((prev) => ({
      ...prev,
      slides: prev.slides.map((slide) => (slide.id === id ? { ...slide, ...partial } : slide)),
    }));
  }

  function moveSlide(id: string, direction: -1 | 1) {
    setForm((prev) => {
      const index = prev.slides.findIndex((slide) => slide.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.slides.length) return prev;
      const slides = [...prev.slides];
      const current = slides[index];
      const neighbor = slides[nextIndex];
      if (!current || !neighbor) return prev;
      slides[index] = neighbor;
      slides[nextIndex] = current;
      return { ...prev, slides };
    });
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(HERO_BANNERS_SQL);
      toast.success("SQL kopyalandı");
    } catch {
      toast.error("Kopyalanamadı — metni elle seçin");
    }
  }

  if (!isFounder) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="text-xl">Reklam yönetimi</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Kayan reklam panosunu yalnızca kurucu hesaplar düzenleyebilir.
        </p>
      </div>
    );
  }

  const previewSlides = form.slides.filter((slide) => slide.active && slide.imageUrl);

  return (
    <div className="space-y-6">
      {!settings.heroBannersConfigured ? (
        <div className="rounded-3xl border border-dashed border-primary/40 bg-card p-6">
          <h2 className="text-lg font-semibold">Şema SQL’si (bir kez)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sütun henüz bu ortamda görünmüyorsa Supabase SQL Editor’da aşağıdaki komutu çalıştırın. Token
            veya veritabanı şifresi gerekmez. <code className="rounded bg-muted px-1">NOTIFY</code> satırı
            API şema önbelleğini yeniler.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-muted p-4 text-xs">{HERO_BANNERS_SQL}</pre>
          <Button type="button" variant="outline" className="mt-3 rounded-full" onClick={() => void copySql()}>
            <Copy className="size-4" />
            SQL’i kopyala
          </Button>
        </div>
      ) : null}

      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 text-accent" />
          <h2 className="text-xl">Kayan reklam panosu</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Ana sayfa kahraman alanındaki slaytlar. Görsel yükleyin, bağlantı ve metin ekleyin, sırayı
          değiştirin. En fazla {MAX_HERO_BANNERS} slayt.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-2xl border border-border p-4">
            <div>
              <p className="text-sm font-medium">Otomatik kaydırma</p>
              <p className="text-xs text-muted-foreground">Fare üzerindeyken durur</p>
            </div>
            <Switch
              checked={form.autoplay}
              onCheckedChange={(autoplay) => setForm((prev) => ({ ...prev, autoplay }))}
            />
          </div>
          <div className="rounded-2xl border border-border p-4">
            <div className="mb-2 flex items-center justify-between">
              <Label>Geçiş süresi</Label>
              <span className="text-xs text-muted-foreground">{form.intervalMs / 1000} sn</span>
            </div>
            <Slider
              min={HERO_INTERVAL_MIN}
              max={HERO_INTERVAL_MAX}
              step={500}
              value={[form.intervalMs]}
              onValueChange={([intervalMs]) =>
                setForm((prev) => ({ ...prev, intervalMs: intervalMs ?? prev.intervalMs }))
              }
            />
          </div>
        </div>

        {previewSlides.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium">Canlı önizleme</p>
            <HeroBannerSlider
              slides={previewSlides}
              autoplay={form.autoplay}
              intervalMs={form.intervalMs}
            />
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Aktif ve görselli slayt yok. Aşağıdan ekleyin; kayıt sonrası ana sayfada görünür.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {form.slides.map((slide, index) => (
          <article key={slide.id} className="rounded-3xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-24 w-40 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
                {slide.imageUrl ? (
                  <img src={slide.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ImageUp className="size-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Slayt {index + 1}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Yayında</span>
                    <Switch
                      checked={slide.active}
                      onCheckedChange={(active) => patchSlide(slide.id, { active })}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`title-${slide.id}`}>Başlık</Label>
                    <Input
                      id={`title-${slide.id}`}
                      value={slide.title}
                      maxLength={80}
                      onChange={(event) => patchSlide(slide.id, { title: event.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`cta-${slide.id}`}>Düğme metni</Label>
                    <Input
                      id={`cta-${slide.id}`}
                      value={slide.ctaLabel}
                      maxLength={40}
                      onChange={(event) => patchSlide(slide.id, { ctaLabel: event.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`sub-${slide.id}`}>Alt metin</Label>
                  <Textarea
                    id={`sub-${slide.id}`}
                    value={slide.subtitle}
                    maxLength={160}
                    onChange={(event) => patchSlide(slide.id, { subtitle: event.target.value })}
                    className="mt-1 min-h-[64px] rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor={`href-${slide.id}`}>Bağlantı</Label>
                  <Input
                    id={`href-${slide.id}`}
                    value={slide.href}
                    placeholder="/restoranlar veya https://…"
                    onChange={(event) => patchSlide(slide.id, { href: event.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`img-${slide.id}`}>Görsel adresi</Label>
                  <Input
                    id={`img-${slide.id}`}
                    value={slide.imageUrl}
                    placeholder="/api/public/brand/hero/… veya https://…"
                    onChange={(event) => patchSlide(slide.id, { imageUrl: event.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                ref={(node) => {
                  fileInputs.current[slide.id] = node;
                }}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setBusyId(slide.id);
                  uploadMutation.mutate({ id: slide.id, file });
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={busyId === slide.id}
                onClick={() => fileInputs.current[slide.id]?.click()}
              >
                <ImageUp className="size-4" />
                {busyId === slide.id ? "Yükleniyor…" : slide.imageUrl ? "Görseli değiştir" : "Görsel yükle"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                disabled={index === 0}
                onClick={() => moveSlide(slide.id, -1)}
              >
                <ChevronUp className="size-4" /> Yukarı
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                disabled={index === form.slides.length - 1}
                onClick={() => moveSlide(slide.id, 1)}
              >
                <ChevronDown className="size-4" /> Aşağı
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full text-destructive"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    slides: prev.slides.filter((item) => item.id !== slide.id),
                  }))
                }
              >
                <Trash2 className="size-4" /> Sil
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={form.slides.length >= MAX_HERO_BANNERS}
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              slides: [...prev.slides, createEmptySlide()],
            }))
          }
        >
          <Plus className="size-4" />
          Slayt ekle
        </Button>
        <Button
          type="button"
          className="rounded-full"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(parseHeroBanners(form))}
        >
          <Save className="size-4" />
          {mutation.isPending ? "Kaydediliyor…" : "Reklamları kaydet"}
        </Button>
      </div>
    </div>
  );
}
