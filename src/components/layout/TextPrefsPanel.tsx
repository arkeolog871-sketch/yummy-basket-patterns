import { Type } from "lucide-react";
import { useTextPrefs } from "@/hooks/useTextPrefs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CUSTOM_SWATCHES = ["#2a241c", "#1a1a1a", "#6b1d12", "#0f3d2e"] as const;

export function TextPrefsPanel() {
  const { prefs, update, reset } = useTextPrefs();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Metin ve tipografi ayarları"
          title="Metin ayarları"
        >
          <Type className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4 p-4" aria-label="Metin kontrol paneli">
        <div>
          <p className="text-sm font-semibold">Metin ayarları</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Yazı boyutu, font ve kontrast. Tercihler bu cihazda saklanır.
          </p>
        </div>

        <fieldset className="space-y-2">
          <Label id="text-size-label" className="text-xs text-muted-foreground">
            Yazı boyutu
          </Label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={prefs.size}
            onValueChange={(value) => {
              if (value === "sm" || value === "md" || value === "lg") update({ size: value });
            }}
            aria-labelledby="text-size-label"
            className="grid w-full grid-cols-3"
          >
            <ToggleGroupItem value="sm" aria-label="Küçük yazı" className="text-xs">
              Küçük
            </ToggleGroupItem>
            <ToggleGroupItem value="md" aria-label="Normal yazı" className="text-xs">
              Normal
            </ToggleGroupItem>
            <ToggleGroupItem value="lg" aria-label="Büyük yazı" className="text-xs">
              Büyük
            </ToggleGroupItem>
          </ToggleGroup>
        </fieldset>

        <fieldset className="space-y-2">
          <Label id="text-font-label" className="text-xs text-muted-foreground">
            Font ailesi
          </Label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={prefs.font}
            onValueChange={(value) => {
              if (value === "sans" || value === "serif" || value === "mono" || value === "system") {
                update({ font: value });
              }
            }}
            aria-labelledby="text-font-label"
            className="grid w-full grid-cols-2 gap-1"
          >
            <ToggleGroupItem value="sans" className="font-sans text-xs">
              Sans
            </ToggleGroupItem>
            <ToggleGroupItem value="serif" className="font-display text-xs">
              Serif
            </ToggleGroupItem>
            <ToggleGroupItem value="mono" className="font-mono text-xs">
              Mono
            </ToggleGroupItem>
            <ToggleGroupItem value="system" className="text-xs [font-family:system-ui,sans-serif]">
              Sistem
            </ToggleGroupItem>
          </ToggleGroup>
        </fieldset>

        <fieldset className="space-y-2">
          <Label id="text-contrast-label" className="text-xs text-muted-foreground">
            Renk / kontrast
          </Label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={prefs.contrast}
            onValueChange={(value) => {
              if (value === "default" || value === "high" || value === "custom") {
                update({ contrast: value });
              }
            }}
            aria-labelledby="text-contrast-label"
            className="grid w-full grid-cols-3"
          >
            <ToggleGroupItem value="default" className="text-xs">
              Varsayılan
            </ToggleGroupItem>
            <ToggleGroupItem value="high" className="text-xs">
              Yüksek
            </ToggleGroupItem>
            <ToggleGroupItem value="custom" className="text-xs">
              Özel
            </ToggleGroupItem>
          </ToggleGroup>
          {prefs.contrast === "custom" ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {CUSTOM_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Metin rengi ${hex}`}
                  onClick={() => update({ customColor: hex })}
                  className="size-7 rounded-full border border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ backgroundColor: hex }}
                />
              ))}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="sr-only">Özel renk seç</span>
                <input
                  type="color"
                  value={prefs.customColor}
                  onChange={(event) => update({ customColor: event.target.value })}
                  className="size-7 cursor-pointer rounded-full border border-border bg-transparent p-0"
                  aria-label="Özel metin rengi"
                />
              </label>
            </div>
          ) : null}
        </fieldset>

        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={reset}>
          Varsayılana dön
        </Button>
      </PopoverContent>
    </Popover>
  );
}
