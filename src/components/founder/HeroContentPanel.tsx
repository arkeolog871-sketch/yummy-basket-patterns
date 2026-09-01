import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Save, RotateCcw, Smartphone, Monitor, Lock } from "lucide-react";
import {
  useSiteSettings,
  DEFAULT_HERO,
  DEFAULT_FOOTER,
  type HeroContent,
  type FooterContent,
} from "@/hooks/useSiteSettings";
import { updateHeroContent } from "@/lib/founder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ContentForm = HeroContent & FooterContent;

const DEFAULT_CONTENT: ContentForm = { ...DEFAULT_HERO, ...DEFAULT_FOOTER };

export function HeroContentPanel() {
  const { hero, footer, refresh, isFounder } = useSiteSettings();
  const save = useServerFn(updateHeroContent);
  const [form, setForm] = useState<ContentForm>({ ...hero, ...footer });
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");

  useEffect(() => setForm({ ...hero, ...footer }), [hero, footer]);

  const mutation = useMutation({
    mutationFn: (values: ContentForm) => save({ data: values }),
    onSuccess: () => {
      toast.success("Site metinleri güncellendi");
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  if (!isFounder) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Lock className="size-5 text-muted-foreground" /> Yetkiniz yok
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ana sayfa ve alt bilgi metinlerini yalnızca sayfa yöneticisi rolüne sahip hesaplar
          düzenleyebilir.
        </p>
      </div>
    );
  }

  function field(key: keyof ContentForm, label: string, hint: string) {
    return (
      <label className="block">
        <span className="text-sm font-semibold">{label}</span>
        <Input
          value={form[key]}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
          className="mt-1.5 rounded-xl"
        />
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      </label>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <h2 className="text-xl">Ana sayfa tanıtım metinleri</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ana sayfanın üst alanındaki etiket, başlık ve açıklama yazılarını buradan düzenleyin.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {field(
          "hero_badge",
          "Üst etiket",
          "İşletme sayısı otomatik eklenir. Örn: “işletme, dakikalar içinde kapınızda”",
        )}
        {field("hero_title", "Başlık", "Örn: “Mahalleniz hazır,”")}
        {field(
          "hero_title_accent",
          "Vurgulu başlık",
          "Renkli görünen kısım. Boş bırakabilirsiniz.",
        )}
        {field("hero_subtitle", "Açıklama", "Başlığın altındaki kısa tanıtım cümlesi.")}
      </div>

      <h3 className="mt-8 text-lg">Alt bilgi (footer)</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Sitenin her sayfasının altında görünen tanıtım cümlesi ve teslimat saatleri metnini buradan
        düzenleyin.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {field(
          "footer_tagline",
          "Tanıtım cümlesi",
          "Marka adının altında gösterilir. Örn: “Mahallenin en iyi ustalarından sıcak yemekler, kapınıza kadar.”",
        )}
        {field(
          "footer_delivery_hours",
          "Teslimat saatleri",
          "“Teslimat saatleri” başlığı altında gösterilir. Örn: “Her gün 10:00 – 23:30”",
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Önizleme</p>
        <div className="flex gap-1 rounded-full border border-border p-1">
          <Button
            type="button"
            size="sm"
            variant={device === "mobile" ? "default" : "ghost"}
            className="rounded-full"
            aria-pressed={device === "mobile"}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="size-4" /> Mobil
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === "desktop" ? "default" : "ghost"}
            className="rounded-full"
            aria-pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="size-4" /> Masaüstü
          </Button>
        </div>
      </div>

      <div className="mt-3 flex justify-center rounded-2xl border border-border bg-muted/40 p-4">
        <div
          className={`w-full overflow-hidden rounded-2xl border border-border bg-gradient-hero p-5 ${
            device === "mobile" ? "max-w-[360px]" : "max-w-full"
          }`}
        >
          <span className="inline-flex items-center rounded-full bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
            8 {form.hero_badge}
          </span>
          <h3 className={`mt-3 leading-tight ${device === "mobile" ? "text-2xl" : "text-4xl"}`}>
            {form.hero_title} <span className="text-accent">{form.hero_title_accent}</span>
          </h3>
          <p
            className={`mt-2 text-muted-foreground ${
              device === "mobile" ? "text-sm" : "max-w-md text-base"
            }`}
          >
            {form.hero_subtitle}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          className="rounded-full"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(form)}
        >
          <Save className="size-4" />
          {mutation.isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => setForm(DEFAULT_CONTENT)}>
          <RotateCcw className="size-4" />
          Varsayılana dön
        </Button>
      </div>
    </div>
  );
}
