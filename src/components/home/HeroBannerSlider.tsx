import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { HeroBannerSlide } from "@/lib/hero-banners";
import { cn } from "@/lib/utils";

export function HeroBannerSlider({
  slides,
  autoplay,
  intervalMs,
  className,
}: {
  slides: HeroBannerSlide[];
  autoplay: boolean;
  intervalMs: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const current = slides[index] ?? slides[0];

  useEffect(() => {
    setIndex(0);
  }, [count]);

  const go = useCallback(
    (next: number) => {
      if (count <= 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (!autoplay || paused || count <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const timer = window.setInterval(() => go(index + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [autoplay, paused, count, intervalMs, index, go]);

  if (!current) return null;

  const media = (
    <img
      src={current.imageUrl}
      alt={current.title || "Kampanya görseli"}
      className="size-full object-cover"
    />
  );

  return (
    <div
      className={cn("hero-banner-slider relative overflow-hidden rounded-3xl border border-border/60 shadow-lifted", className)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Kampanya panosu"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[16/10] min-h-[220px] w-full bg-muted sm:min-h-[280px]">
        {current.href ? (
          <a
            href={current.href}
            className="block size-full"
            aria-label={current.title || "Kampanyayı aç"}
            {...(current.href.startsWith("http")
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {media}
          </a>
        ) : (
          media
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        {(current.title || current.subtitle || current.ctaLabel) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-6">
            {current.title ? (
              <p className="text-lg font-semibold text-white drop-shadow sm:text-2xl">{current.title}</p>
            ) : null}
            {current.subtitle ? (
              <p className="mt-1 max-w-md text-sm text-white/90 drop-shadow">{current.subtitle}</p>
            ) : null}
            {current.ctaLabel && current.href ? (
              <span className="pointer-events-none mt-3 inline-flex rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
                {current.ctaLabel}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background"
            aria-label="Önceki reklam"
            onClick={() => go(index - 1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background"
            aria-label="Sonraki reklam"
            onClick={() => go(index + 1)}
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`${i + 1}. slayt`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
                onClick={() => go(i)}
              />
            ))}
          </div>
          {autoplay ? (
            <button
              type="button"
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur"
              aria-label={paused ? "Otomatik kaydırmayı başlat" : "Otomatik kaydırmayı durdur"}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
