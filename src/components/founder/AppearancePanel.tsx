import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Tags } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { updateSiteSettings } from "@/lib/founder.functions";
import { useAppCategories, type AppCategory } from "@/hooks/useTaxonomy";
import { saveCategory } from "@/lib/taxonomy.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ThemeMode = "light" | "dark";
type LayoutVariant = "classic" | "compact" | "spotlight";

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

      <CategoryColorPanel />
    </div>
  );
}

/** Kategori renk seçenekleri bilinçli olarak yumuşatılmış (düşük doygunluk) —
 * ana sayfadaki kategori çubuğunda ve görseli olmayan işletme kartlarında
 * geniş bir zemin dolgusu olarak kullanıldıkları için parlak/cırt tonlar
 * göz yormasın diye tercih edildi. */
const CATEGORY_COLOR_SUGGESTIONS = [
  "#C4636B",
  "#D98A55",
  "#D9A544",
  "#A8A344",
  "#5FA372",
  "#4F8F6B",
  "#4FA8A0",
  "#5B9BD9",
  "#6B7FD9",
  "#9B7FD4",
  "#B06BA0",
  "#D97FA0",
  "#E0876F",
  "#C9A227",
  "#A98467",
  "#7A8FA6",
];

/** Ana sayfadaki kategori çubuğunda her kategori kendi rengiyle görünsün diye kullanılır. */
function CategoryColorPanel() {
  const { categories } = useAppCategories({ includeHidden: true });
  const queryClient = useQueryClient();
  const save = useServerFn(saveCategory);
  const [draft, setDraft] = useState<Record<string, string | null>>({});

  const mutation = useMutation({
    mutationFn: (category: AppCategory) =>
      save({
        data: {
          id: category.id,
          slug: category.slug,
          label: category.label,
          icon: category.icon,
          position: category.position,
          is_active: category.is_active,
          color: draft[category.id] ?? category.color,
        },
      }),
    onSuccess: () => {
      toast.success("Kategori rengi kaydedildi");
      void queryClient.invalidateQueries({ queryKey: ["app-categories"] });
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Tags className="size-4 text-accent" />
        <h2 className="text-xl">Kategori renkleri</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Ana sayfadaki kategori çubuğunda her kategori kendi rengiyle görünür. Boş bırakılan
        kategoriler varsayılan (ana renk) ile gösterilir.
      </p>

      {categories.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Henüz kategori eklenmemiş.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {categories.map((category) => {
            const value = draft[category.id] ?? category.color ?? "";
            const saving = mutation.isPending && mutation.variables?.id === category.id;
            return (
              <div
                key={category.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {category.label}
                  {category.is_active ? null : (
                    <span className="ml-2 text-xs text-muted-foreground">(gizli)</span>
                  )}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {CATEGORY_COLOR_SUGGESTIONS.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={swatch}
                      onClick={() => setDraft((current) => ({ ...current, [category.id]: swatch }))}
                      className={`size-6 shrink-0 rounded-full border-2 transition-transform ${
                        value === swatch ? "scale-110 border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: swatch }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  aria-label={`${category.label} rengi`}
                  value={value || "#94a3b8"}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [category.id]: event.target.value }))
                  }
                  className="size-9 shrink-0 cursor-pointer rounded-xl border border-border bg-transparent"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setDraft((current) => ({ ...current, [category.id]: null }))}
                >
                  Varsayılana dön
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(category)}
                >
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
