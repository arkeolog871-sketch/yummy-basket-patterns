import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { decomposeColor, hslToRgb, toHex } from "@/lib/typography";

type ColorFieldProps = {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
};

function compose(r: number, g: number, b: number, a: number): string {
  const rr = Math.max(0, Math.min(255, Math.round(r)));
  const gg = Math.max(0, Math.min(255, Math.round(g)));
  const bb = Math.max(0, Math.min(255, Math.round(b)));
  const aa = Math.max(0, Math.min(1, a));
  if (aa >= 0.995) return toHex(rr, gg, bb);
  return `rgba(${rr}, ${gg}, ${bb}, ${Math.round(aa * 100) / 100})`;
}

export function ColorField({ id, label, hint, value, onChange }: ColorFieldProps) {
  const parsed = useMemo(() => decomposeColor(value), [value]);
  const opaqueHex = toHex(parsed.r, parsed.g, parsed.b);

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor={id}>{label}</Label>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span
          className="size-9 shrink-0 rounded-xl border border-border/70 shadow-inner"
          style={{ backgroundColor: value }}
          aria-hidden
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={opaqueHex}
          onChange={(event) => {
            const next = decomposeColor(event.target.value);
            onChange(compose(next.r, next.g, next.b, parsed.a));
          }}
          className="size-10 shrink-0 cursor-pointer rounded-xl border border-border bg-transparent"
        />
        <Input
          aria-label={`${label} HEX`}
          value={parsed.hex}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono text-xs uppercase"
        />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {(["r", "g", "b"] as const).map((channel) => (
          <div key={channel}>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground" htmlFor={`${id}-${channel}`}>
              {channel.toUpperCase()}
            </Label>
            <Input
              id={`${id}-${channel}`}
              type="number"
              min={0}
              max={255}
              value={Math.round(parsed[channel])}
              onChange={(event) => {
                const n = Number(event.target.value);
                onChange(
                  compose(
                    channel === "r" ? n : parsed.r,
                    channel === "g" ? n : parsed.g,
                    channel === "b" ? n : parsed.b,
                    parsed.a,
                  ),
                );
              }}
              className="mt-1 h-8 px-2 text-xs"
            />
          </div>
        ))}
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground" htmlFor={`${id}-a`}>
            Alpha
          </Label>
          <Input
            id={`${id}-a`}
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={Math.round(parsed.a * 100) / 100}
            onChange={(event) => onChange(compose(parsed.r, parsed.g, parsed.b, Number(event.target.value)))}
            className="mt-1 h-8 px-2 text-xs"
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground" htmlFor={`${id}-h`}>
            H
          </Label>
          <Input
            id={`${id}-h`}
            type="number"
            min={0}
            max={360}
            value={parsed.h}
            onChange={(event) => {
              const rgb = hslToRgb(Number(event.target.value), parsed.s / 100, parsed.l / 100);
              onChange(compose(rgb.r, rgb.g, rgb.b, parsed.a));
            }}
            className="mt-1 h-8 px-2 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground" htmlFor={`${id}-s`}>
            S %
          </Label>
          <Input
            id={`${id}-s`}
            type="number"
            min={0}
            max={100}
            value={parsed.s}
            onChange={(event) => {
              const rgb = hslToRgb(parsed.h, Number(event.target.value) / 100, parsed.l / 100);
              onChange(compose(rgb.r, rgb.g, rgb.b, parsed.a));
            }}
            className="mt-1 h-8 px-2 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground" htmlFor={`${id}-l`}>
            L %
          </Label>
          <Input
            id={`${id}-l`}
            type="number"
            min={0}
            max={100}
            value={parsed.l}
            onChange={(event) => {
              const rgb = hslToRgb(parsed.h, parsed.s / 100, Number(event.target.value) / 100);
              onChange(compose(rgb.r, rgb.g, rgb.b, parsed.a));
            }}
            className="mt-1 h-8 px-2 text-xs"
          />
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Opaklık</span>
          <span>{Math.round(parsed.a * 100)}%</span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[parsed.a]}
          onValueChange={([a]) => onChange(compose(parsed.r, parsed.g, parsed.b, a ?? 1))}
        />
      </div>
    </div>
  );
}
