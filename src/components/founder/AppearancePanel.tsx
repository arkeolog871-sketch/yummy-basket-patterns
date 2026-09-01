import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Palette } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { updateSiteSettings } from "@/lib/founder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ThemeMode = "light" | "dark";
type LayoutVariant = "classic" | "compact" | "spotlight";

type Preset = {
  id: string;
  name: string;
  hint: string;
  theme_mode: ThemeMode;
  layout_variant: LayoutVariant;
  primary_color: string;
  accent_color: string;
  secondary_color: string;
  background_color: string;
  warm_color: string;
};

const PRESETS: Preset[] = [
  {
    id: "warm-light",
    name: "Açık — Sıcak Sofra",
    hint: "Turuncu ana renk, krem arka plan",
    theme_mode: "light",
    layout_variant: "classic",
    primary_color: "#ff8c42",
    accent_color: "#e63946",
    secondary_color: "#ffe9d6",
    background_color: "#fff8f0",
    warm_color: "#f3dfc0",
  },
  {
    id: "fresh-light",
    name: "Açık — Ferah Yeşil",
    hint: "Market ve manav odaklı ferah palet",
    theme_mode: "light",
    layout_variant: "classic",
    primary_color: "#2f9e6b",
    accent_color: "#f2b705",
    secondary_color: "#e4f5ec",
    background_color: "#f7fdf9",
    warm_color: "#d9f0df",
  },
  {
    id: "night-dark",
    name: "Koyu — Gece Servisi",
    hint: "Koyu zemin, sıcak vurgular",
    theme_mode: "dark",
    layout_variant: "classic",
    primary_color: "#ff9f5a",
    accent_color: "#ff5d73",
    secondary_color: "#2a2320",
    background_color: "#17130f",
    warm_color: "#3a2e24",
  },
  {
    id: "backup-compact",
    name: "Yedek — Kompakt Mavi",
    hint: "Yoğun liste düzeni, kurumsal mavi",
    theme_mode: "light",
    layout_variant: "compact",
    primary_color: "#2563eb",
    accent_color: "#0ea5e9",
    secondary_color: "#e2ecff",
    background_color: "#f6f9ff",
    warm_color: "#dbe8ff",
  },
  {
    id: "backup-spotlight",
    name: "Yedek — Vitrin Bordo",
    hint: "Büyük kartlar, iddialı bordo",
    theme_mode: "light",
    layout_variant: "spotlight",
    primary_color: "#9d174d",
    accent_color: "#f59e0b",
    secondary_color: "#fbe6ef",
    background_color: "#fff7fa",
    warm_color: "#fbe0ec",
  },
];

const LAYOUTS: { value: LayoutVariant; label: string; hint: string }[] = [
  { value: "classic", label: "Klasik", hint: "Sıcak sofra düzeni, 3 kolon" },
  { value: "compact", label: "Yedek: Kompakt", hint: "Yoğun liste, daha fazla kart" },
  { value: "spotlight", label: "Yedek: Vitrin", hint: "Büyük kartlar, tek odak" },
];

const COLOR_FIELDS = [
  { key: "primary_color", label: "Ana renk (primary)" },
  { key: "secondary_color", label: "İkincil renk (secondary)" },
  { key: "accent_color", label: "Vurgu rengi (accent)" },
  { key: "background_color", label: "Arka plan rengi" },
  { key: "warm_color", label: "Sıcak ton (rozet, logo, ana sayfa üst alanı)" },
] as const;

export function AppearancePanel() {
  const { settings, refresh } = useSiteSettings();
  const save = useServerFn(updateSiteSettings);
  const [form, setForm] = useState({
    brand_name: settings.brand_name,
    primary_color: settings.primary_color,
    accent_color: settings.accent_color,
    secondary_color: settings.secondary_color,
    background_color: settings.background_color,
    warm_color: settings.warm_color,
    theme_mode: settings.theme_mode as ThemeMode,
    layout_variant: settings.layout_variant as LayoutVariant,
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form) => save({ data: values }),
    onSuccess: () => {
      toast.success("Tema ayarları kaydedildi");
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  function applyPreset(preset: Preset) {
    const next = {
      ...form,
      primary_color: preset.primary_color,
      accent_color: preset.accent_color,
      secondary_color: preset.secondary_color,
      background_color: preset.background_color,
      warm_color: preset.warm_color,
      theme_mode: preset.theme_mode,
      layout_variant: preset.layout_variant,
    };
    setForm(next);
    mutation.mutate(next);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-accent" />
          <h2 className="text-xl">Hazır renk kombinasyonları</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Açık, koyu ve yedek tasarım şablonları — seçtiğinizde anında uygulanır.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary"
            >
              <p className="text-sm font-semibold">{preset.name}</p>
              <p className="text-xs text-muted-foreground">{preset.hint}</p>
              <div className="mt-3 flex gap-1.5">
                {[
                  preset.primary_color,
                  preset.secondary_color,
                  preset.accent_color,
                  preset.background_color,
                  preset.warm_color,
                ].map((color) => (
                  <span
                    key={color}
                    className="size-6 rounded-lg border border-border/60"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

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

          <div className="grid gap-4 sm:grid-cols-2">
            {COLOR_FIELDS.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id={field.key}
                    type="color"
                    value={form[field.key]}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                    className="size-10 shrink-0 cursor-pointer rounded-xl border border-border bg-transparent"
                  />
                  <Input
                    value={form[field.key]}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border p-4">
            <div>
              <p className="text-sm font-medium">Karanlık mod</p>
              <p className="text-xs text-muted-foreground">Tüm kullanıcılar için varsayılan tema</p>
            </div>
            <Switch
              checked={form.theme_mode === "dark"}
              onCheckedChange={(checked) =>
                setForm({ ...form, theme_mode: checked ? "dark" : "light" })
              }
            />
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
              <p className="text-xs text-muted-foreground">{layout.hint}</p>
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
