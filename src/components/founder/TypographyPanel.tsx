import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Italic,
  Type,
  Underline,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toPublicErrorMessage } from "@/lib/public-error";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { updateTypography } from "@/lib/founder.functions";
import { ColorField } from "@/components/founder/ColorField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  applyTypeScale,
  applyTypographyCss,
  COLOR_PALETTES,
  contrastRatio,
  DEFAULT_TYPOGRAPHY,
  FONT_FAMILIES,
  FONT_WEIGHT_LABELS,
  FONT_WEIGHTS,
  parseTypography,
  TYPE_SCALE_RATIOS,
  type ColorPaletteKey,
  type FontFamilyKey,
  type TextTransform,
  type TypeScaleRatioKey,
  type TypographySettings,
} from "@/lib/typography";

const FONT_GROUPS: { category: string; keys: FontFamilyKey[] }[] = [
  { category: "Modern Sans-Serif", keys: ["inter", "roboto", "plusJakarta"] },
  { category: "Classic Serif", keys: ["playfair", "merriweather", "fraunces"] },
  { category: "Monospace", keys: ["mono"] },
  { category: "Sistem Varsayılanı", keys: ["system"] },
];

function ContrastBadge({ fg, bg, large }: { fg: string; bg: string; large?: boolean }) {
  const result = contrastRatio(fg, bg);
  const grade = large ? result.large : result.body;
  const needed = large ? "AAA 4.5:1" : "AAA 7:1";
  const ok = grade === "AAA";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        ok
          ? "border-success/30 bg-success/10 text-success-foreground"
          : grade === "AA"
            ? "border-primary/30 bg-primary/10"
            : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
    >
      {ok ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
      {result.ratio.toFixed(2)}:1 · {grade === "fail" ? "Yetersiz" : grade} ({needed})
    </span>
  );
}

function SizeRow({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-1.5">
          <Input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => {
              const n = Number(event.target.value);
              if (!Number.isFinite(n)) return;
              onChange(Math.min(max, Math.max(min, n)));
            }}
            className="h-8 w-20 px-2 text-right text-xs"
          />
          <span className="w-8 text-[11px] text-muted-foreground">{unit}</span>
        </div>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([n]) => onChange(n ?? value)} />
    </div>
  );
}

export function TypographyPanel() {
  const { settings, refresh } = useSiteSettings();
  const save = useServerFn(updateTypography);
  const [form, setForm] = useState<TypographySettings>(() => parseTypography(settings.typography));
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setForm(parseTypography(settings.typography));
  }, [settings.typography]);

  useEffect(() => {
    if (!previewRef.current) return;
    applyTypographyCss(form, previewRef.current);
  }, [form]);

  const mutation = useMutation({
    mutationFn: (values: TypographySettings) => save({ data: values }),
    onSuccess: (_data, values) => {
      toast.success("Global tipografi kaydedildi");
      if (typeof document !== "undefined") applyTypographyCss(values);
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  function patch(partial: Partial<TypographySettings>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function scaleFromBody(bodySizePx: number, ratio: TypeScaleRatioKey) {
    patch({ bodySizePx, scaleRatio: ratio, ...applyTypeScale(bodySizePx, ratio) });
  }

  function applyPalette(key: ColorPaletteKey) {
    patch(COLOR_PALETTES[key].colors);
  }

  const bodyPt = useMemo(() => Math.round(form.bodySizePx * 0.75 * 10) / 10, [form.bodySizePx]);
  const bodyRem = useMemo(() => Math.round((form.bodySizePx / 16) * 1000) / 1000, [form.bodySizePx]);
  const bg = settings.background_color || "#fff8f0";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Type className="size-4 text-accent" />
            <h2 className="text-xl">Global tipografi ve stilleme</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Buradaki stiller <code className="rounded bg-muted px-1">site_settings.typography</code> kaydına yazılır ve
            tüm uygulamada CSS değişkenleri (<code className="rounded bg-muted px-1">--font-main</code>,{" "}
            <code className="rounded bg-muted px-1">--text-primary</code>,{" "}
            <code className="rounded bg-muted px-1">--h1-size</code>) üzerinden uygulanır. Metne satır içi stil
            yazılmaz — hydration güvenlidir.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setForm({ ...DEFAULT_TYPOGRAPHY })}
          >
            <RotateCcw className="size-4" />
            Varsayılan
          </Button>
          <Button
            type="button"
            className="rounded-full"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(parseTypography(form))}
          >
            <Save className="size-4" />
            {mutation.isPending ? "Kaydediliyor…" : "Kaydet ve uygula"}
          </Button>
        </div>
      </div>

      <LivePreviewCard ref={previewRef} form={form} background={bg} />

      <section className="rounded-3xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold">1. Punto ve boyutlandırma</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Gövde 12–24px. Başlıklar bağımsız rem + type scale. Harf aralığı −2px / +5px, satır yüksekliği 1.0–2.5.
        </p>

        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="body-size">Temel gövde metni (Body)</Label>
                <p className="text-[11px] text-muted-foreground">
                  {form.bodySizePx}px · {bodyRem}rem · {bodyPt}pt
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  min={12}
                  max={24}
                  step={1}
                  value={[form.bodySizePx]}
                  onValueChange={([n]) => scaleFromBody(n ?? form.bodySizePx, form.scaleRatio)}
                  className="flex-1"
                />
                <Input
                  id="body-size"
                  type="number"
                  min={12}
                  max={24}
                  value={form.bodySizePx}
                  onChange={(event) => {
                    const n = Math.min(24, Math.max(12, Number(event.target.value) || 16));
                    scaleFromBody(n, form.scaleRatio);
                  }}
                  className="h-9 w-20 text-right"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="scale-ratio">Başlık ölçek oranı (Type Scale Ratio)</Label>
              <select
                id="scale-ratio"
                value={form.scaleRatio}
                onChange={(event) =>
                  scaleFromBody(form.bodySizePx, event.target.value as TypeScaleRatioKey)
                }
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {(Object.keys(TYPE_SCALE_RATIOS) as TypeScaleRatioKey[]).map((key) => (
                  <option key={key} value={key}>
                    {TYPE_SCALE_RATIOS[key].label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Oran veya gövde punto değişince H1–H4 yeniden hesaplanır; ardından her başlığı ayrı ince ayar
                yapabilirsiniz.
              </p>
            </div>

            <SizeRow
              id="h1"
              label="H1"
              value={form.h1SizeRem}
              min={0.75}
              max={6}
              step={0.025}
              unit="rem"
              onChange={(h1SizeRem) => patch({ h1SizeRem })}
            />
            <SizeRow
              id="h2"
              label="H2"
              value={form.h2SizeRem}
              min={0.75}
              max={5}
              step={0.025}
              unit="rem"
              onChange={(h2SizeRem) => patch({ h2SizeRem })}
            />
            <SizeRow
              id="h3"
              label="H3"
              value={form.h3SizeRem}
              min={0.75}
              max={4}
              step={0.025}
              unit="rem"
              onChange={(h3SizeRem) => patch({ h3SizeRem })}
            />
            <SizeRow
              id="h4"
              label="H4"
              value={form.h4SizeRem}
              min={0.75}
              max={3}
              step={0.025}
              unit="rem"
              onChange={(h4SizeRem) => patch({ h4SizeRem })}
            />
          </div>

          <div className="space-y-5">
            <SizeRow
              id="tracking"
              label="Harf aralığı (Letter Spacing / Tracking)"
              value={form.letterSpacingPx}
              min={-2}
              max={5}
              step={0.1}
              unit="px"
              onChange={(letterSpacingPx) => patch({ letterSpacingPx })}
            />
            <SizeRow
              id="heading-tracking"
              label="Başlık harf aralığı"
              value={form.headingLetterSpacingPx}
              min={-2}
              max={5}
              step={0.1}
              unit="px"
              onChange={(headingLetterSpacingPx) => patch({ headingLetterSpacingPx })}
            />
            <SizeRow
              id="leading"
              label="Satır yüksekliği (Line Height / Leading)"
              value={form.lineHeight}
              min={1}
              max={2.5}
              step={0.05}
              unit=""
              onChange={(lineHeight) => patch({ lineHeight })}
            />
            <SizeRow
              id="heading-leading"
              label="Başlık satır yüksekliği"
              value={form.headingLineHeight}
              min={1}
              max={2.5}
              step={0.05}
              unit=""
              onChange={(headingLineHeight) => patch({ headingLineHeight })}
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold">2. Renk paleti ve yelpazesi</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          HEX, RGB, HSL ve Alpha. Kontrast, Görünüm sekmesindeki arka plan rengine göre WCAG AAA skorlanır.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(COLOR_PALETTES) as ColorPaletteKey[]).map((key) => {
            const preset = COLOR_PALETTES[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPalette(key)}
                className="rounded-2xl border border-border p-3 text-left transition-colors hover:border-primary"
              >
                <p className="text-sm font-semibold">{preset.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{preset.hint}</p>
                <div className="mt-2 flex gap-1">
                  {[
                    preset.colors.headingText,
                    preset.colors.primaryText,
                    preset.colors.mutedText,
                    preset.colors.accent,
                  ].map((color) => (
                    <span
                      key={color}
                      className="h-5 flex-1 rounded-md border border-border/60"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <ColorField
              id="primary-text"
              label="Ana metin rengi"
              hint="Primary Text Color"
              value={form.primaryText}
              onChange={(primaryText) => patch({ primaryText })}
            />
            <div className="px-1">
              <ContrastBadge fg={form.primaryText} bg={bg} />
            </div>
            <ColorField
              id="muted-text"
              label="İkincil / soluk metin"
              hint="Muted / Secondary Text"
              value={form.mutedText}
              onChange={(mutedText) => patch({ mutedText })}
            />
            <div className="px-1">
              <ContrastBadge fg={form.mutedText} bg={bg} />
            </div>
          </div>
          <div className="space-y-3">
            <ColorField
              id="heading-text"
              label="Başlık metin rengi"
              hint="Heading Color"
              value={form.headingText}
              onChange={(headingText) => patch({ headingText })}
            />
            <div className="px-1">
              <ContrastBadge fg={form.headingText} bg={bg} large />
            </div>
            <ColorField
              id="accent-text"
              label="Vurgu / link rengi"
              hint="Accent & Link Color"
              value={form.accent}
              onChange={(accent) => patch({ accent })}
            />
            <ColorField
              id="accent-hover"
              label="Link hover rengi"
              hint="Hover State"
              value={form.accentHover}
              onChange={(accentHover) => patch({ accentHover })}
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold">3. Yazı stili ve tipografi özellikleri</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Google Fonts yalnızca seçilen aile için, hata durumunda kaldırılan safe-load ile eklenir.
        </p>

        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <FontFamilyPicker
            label="Gövde yazı ailesi"
            value={form.fontFamily}
            onChange={(fontFamily) => patch({ fontFamily })}
          />
          <FontFamilyPicker
            label="Başlık yazı ailesi"
            value={form.headingFontFamily}
            onChange={(headingFontFamily) => patch({ headingFontFamily })}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <WeightRow
            label="Gövde ağırlığı (Font Weight)"
            value={form.fontWeight}
            onChange={(fontWeight) => patch({ fontWeight })}
          />
          <WeightRow
            label="Başlık ağırlığı"
            value={form.headingFontWeight}
            onChange={(headingFontWeight) => patch({ headingFontWeight })}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <Label>Metin dönüştürme (gövde)</Label>
            <TransformGroup
              value={form.textTransform}
              onChange={(textTransform) => patch({ textTransform })}
            />
          </div>
          <div>
            <Label>Metin dönüştürme (başlık)</Label>
            <TransformGroup
              value={form.headingTransform}
              onChange={(headingTransform) => patch({ headingTransform })}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Toggle
            pressed={form.italic}
            onPressedChange={(italic) => patch({ italic })}
            variant="outline"
            aria-label="Gövde italik"
          >
            <Italic className="size-4" /> Gövde italik
          </Toggle>
          <Toggle
            pressed={form.headingItalic}
            onPressedChange={(headingItalic) => patch({ headingItalic })}
            variant="outline"
            aria-label="Başlık italik"
          >
            <Italic className="size-4" /> Başlık italik
          </Toggle>
          <Toggle
            pressed={form.underline}
            onPressedChange={(underline) => patch({ underline })}
            variant="outline"
            aria-label="Gövde altı çizili"
          >
            <Underline className="size-4" /> Gövde altı çizili
          </Toggle>
          <Toggle
            pressed={form.headingUnderline}
            onPressedChange={(headingUnderline) => patch({ headingUnderline })}
            variant="outline"
            aria-label="Başlık altı çizili"
          >
            <Underline className="size-4" /> Başlık altı çizili
          </Toggle>
        </div>

        <div className="mt-6 rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Yazı gölgesi (Text Shadow)</p>
              <p className="text-xs text-muted-foreground">X, Y, Blur ve renk</p>
            </div>
            <Switch
              checked={form.shadowEnabled}
              onCheckedChange={(shadowEnabled) => patch({ shadowEnabled })}
            />
          </div>
          {form.shadowEnabled ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <SizeRow
                id="sx"
                label="X"
                value={form.shadowX}
                min={-20}
                max={20}
                step={1}
                unit="px"
                onChange={(shadowX) => patch({ shadowX })}
              />
              <SizeRow
                id="sy"
                label="Y"
                value={form.shadowY}
                min={-20}
                max={20}
                step={1}
                unit="px"
                onChange={(shadowY) => patch({ shadowY })}
              />
              <SizeRow
                id="sb"
                label="Blur"
                value={form.shadowBlur}
                min={0}
                max={40}
                step={1}
                unit="px"
                onChange={(shadowBlur) => patch({ shadowBlur })}
              />
              <div className="sm:col-span-3">
                <ColorField
                  id="shadow-color"
                  label="Gölge rengi"
                  value={form.shadowColor}
                  onChange={(shadowColor) => patch({ shadowColor })}
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function FontFamilyPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FontFamilyKey;
  onChange: (next: FontFamilyKey) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 space-y-3">
        {FONT_GROUPS.map((group) => (
          <div key={group.category}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.category}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.keys.map((key) => {
                const spec = FONT_FAMILIES[key];
                const active = value === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      active ? "border-primary bg-warm text-warm-foreground" : "border-border hover:bg-secondary"
                    }`}
                    style={{ fontFamily: spec.stack }}
                  >
                    {spec.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeightRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">
          {value} · {FONT_WEIGHT_LABELS[value] ?? ""}
        </span>
      </div>
      <Slider
        min={100}
        max={900}
        step={100}
        value={[value]}
        onValueChange={([n]) => onChange(n ?? value)}
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {FONT_WEIGHTS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
    </div>
  );
}

function TransformGroup({
  value,
  onChange,
}: {
  value: TextTransform;
  onChange: (next: TextTransform) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as TextTransform);
      }}
      variant="outline"
      className="mt-2 justify-start"
    >
      <ToggleGroupItem value="none" className="text-xs">
        Normal
      </ToggleGroupItem>
      <ToggleGroupItem value="uppercase" className="text-xs">
        UPPERCASE
      </ToggleGroupItem>
      <ToggleGroupItem value="lowercase" className="text-xs">
        lowercase
      </ToggleGroupItem>
      <ToggleGroupItem value="capitalize" className="text-xs">
        Capitalize
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

const LivePreviewCard = forwardRef<HTMLDivElement, { form: TypographySettings; background: string }>(
  function LivePreviewCard({ form, background }, ref) {
  return (
    <section
      ref={ref}
      className="typography-live-preview overflow-hidden rounded-3xl border border-border shadow-card"
      style={{ backgroundColor: background }}
      id="typography-preview"
    >
      <div className="border-b border-border/60 px-6 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Canlı tipografi önizleme kartı
        </p>
      </div>
      <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="preview-kicker">Header · {FONT_FAMILIES[form.headingFontFamily].label}</p>
          <h1>Mahalleniz hazır, kapınıza geliyor</h1>
          <h2>Silvan&apos;ın işletmeleri tek uygulamada</h2>
          <h3>Öne çıkan kategoriler</h3>
          <h4>Restoran, market ve daha fazlası</h4>
          <p>
            Gövde metni bu kartta anında güncellenir. Kaydettiğinizde Header, içerik, düğmeler ve kartlar aynı CSS
            değişkenlerini kullanır.
          </p>
          <p className="preview-muted">
            İkincil / soluk metin — teslimat süresi, adres ve yardımcı açıklamalar bu tonda görünür.
          </p>
          <p>
            Vurgu için bir <a href="#typography-preview">bağlantı örneği</a> ve hover durumunu deneyin.
          </p>
        </div>
        <div className="preview-card">
          <h3>Kart başlığı</h3>
          <p className="preview-muted">Kart gövdesi ve düğme tipografisi</p>
          <div className="preview-actions">
            <button type="button" className="preview-btn-primary">
              Sipariş ver
            </button>
            <button type="button" className="preview-btn-ghost">
              İncele
            </button>
          </div>
        </div>
      </div>
    </section>
  );
  },
);
