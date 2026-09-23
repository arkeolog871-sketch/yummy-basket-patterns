import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { updateSiteSettings } from "@/lib/founder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMBLEM_SEED,
  seedFromHex,
  themeContrastReport,
  themeHexColumns,
  type BrandSeed,
} from "@/lib/theme-palette";

type ThemeMode = "light" | "dark" | "system";

const THEME_MODES: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Otomatik" },
  { value: "light", label: "Açık" },
  { value: "dark", label: "Koyu" },
];
type LayoutVariant = "classic" | "compact" | "spotlight";

const LAYOUTS: { value: LayoutVariant; label: string; hint: string }[] = [
  { value: "classic", label: "Klasik", hint: "Sıcak sofra düzeni, 3 kolon" },
  { value: "compact", label: "Yedek: Kompakt", hint: "Yoğun liste, daha fazla kart" },
  { value: "spotlight", label: "Yedek: Vitrin", hint: "Büyük kartlar, tek odak" },
];

/**
 * Renkler artık 5 serbest alan değil, TEK TOHUM: ton + cesaret
 * (theme-palette.ts). Serbest alanlarla canlıda vurgu, ikincil ve arka plan
 * aynı krem seçilmişti; tuşlar ve simgeler görünmez olmuştu. Tohumdan
 * türetilen tema her durumda okunaklıdır.
 */

export function AppearancePanel() {
  const { settings, refresh } = useSiteSettings();
  const save = useServerFn(updateSiteSettings);
  const [seed, setSeed] = useState<BrandSeed>(() => seedFromHex(settings.primary_color));
  const [form, setForm] = useState({
    brand_name: settings.brand_name,
    theme_mode: (THEME_MODES.some((mode) => mode.value === settings.theme_mode)
      ? settings.theme_mode
      : "light") as ThemeMode,
    layout_variant: settings.layout_variant as LayoutVariant,
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form) => save({ data: { ...values, ...themeHexColumns(seed) } }),
    onSuccess: () => {
      toast.success("Tema ayarları kaydedildi");
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 rounded-3xl border border-border bg-card p-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <Label htmlFor="brand">Marka adı</Label>
            <Input
              id="brand"
              value={form.brand_name}
              onChange={(event) => setForm({ ...form, brand_name: event.target.value })}
              className="mt-1.5"
            />
          </div>

          <ThemeSeedControls seed={seed} onChange={setSeed} />

          <div className="space-y-2 rounded-2xl border border-border p-4">
            <div>
              <p className="text-sm font-medium">Tema</p>
              <p className="text-xs text-muted-foreground">
                Otomatik: ziyaretçinin cihazı koyu moddaysa koyu tema. Uygulamalar şimdilik hep açık
                temada kalır (cihaz ayarını iletmiyorlar).
              </p>
            </div>
            <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
              {THEME_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={form.theme_mode === mode.value}
                  onClick={() => setForm({ ...form, theme_mode: mode.value })}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    form.theme_mode === mode.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Tasarım seçenekleri</p>
          {LAYOUTS.map((layout) => (
            <button
              key={layout.value}
              type="button"
              onClick={() => setForm({ ...form, layout_variant: layout.value })}
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                form.layout_variant === layout.value
                  ? "border-primary bg-warm text-warm-foreground"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <p className="text-sm font-semibold">{layout.label}</p>
              <p
                className={`text-xs ${
                  form.layout_variant === layout.value
                    ? "text-warm-foreground/80"
                    : "text-muted-foreground"
                }`}
              >
                {layout.hint}
              </p>
            </button>
          ))}

          <Button
            className="mt-2 w-full rounded-full"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            Ayarları kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Ton + cesaret seçimi, canlı önizleme ve okunaklılık raporu. */
function ThemeSeedControls({
  seed,
  onChange,
}: {
  seed: BrandSeed;
  onChange: (seed: BrandSeed) => void;
}) {
  const colors = useMemo(() => themeHexColumns(seed), [seed]);
  const report = useMemo(() => themeContrastReport(seed), [seed]);
  const weakest = Math.min(...report.text.map((row) => row.ratio));
  const swatches = [
    { label: "Ana renk", color: colors.primary_color },
    { label: "Vurgu", color: colors.accent_color },
    { label: "İkincil", color: colors.secondary_color },
    { label: "Zemin", color: colors.background_color },
  ];

  return (
    <div className="space-y-4 rounded-2xl border border-border p-4">
      <div>
        <p className="text-sm font-medium">Marka renkleri</p>
        <p className="text-xs text-muted-foreground">
          Bütün renkler tek bir marka tonundan otomatik türetilir; her yazı zemininden en az 4.5:1
          okunaklı kalır.
        </p>
      </div>

      <div>
        <Label htmlFor="seed-hue">Marka tonu</Label>
        <input
          id="seed-hue"
          type="range"
          min={0}
          max={359}
          step={1}
          value={Math.round(seed.hue)}
          onChange={(event) => onChange({ ...seed, hue: Number(event.target.value) })}
          className="mt-2 h-3 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.55 0.15 0), oklch(0.55 0.15 60), oklch(0.55 0.15 120), oklch(0.55 0.15 180), oklch(0.55 0.15 240), oklch(0.55 0.15 300), oklch(0.55 0.15 360))",
          }}
        />
      </div>

      <div>
        <Label htmlFor="seed-boldness">
          Cesaret (doygunluk) — %{Math.round(seed.boldness * 100)}
        </Label>
        <input
          id="seed-boldness"
          type="range"
          min={25}
          max={100}
          step={1}
          value={Math.round(seed.boldness * 100)}
          onChange={(event) => onChange({ ...seed, boldness: Number(event.target.value) / 100 })}
          className="mt-2 w-full cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {swatches.map((swatch) => (
          <div key={swatch.label} className="text-center">
            <span
              className="block h-10 rounded-xl border border-border"
              style={{ backgroundColor: swatch.color }}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">{swatch.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          En zayıf yazı okunaklılığı: <strong>{weakest.toFixed(1)}:1</strong>
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => onChange(EMBLEM_SEED)}
        >
          Amblemin bordosuna dön
        </Button>
      </div>
    </div>
  );
}
