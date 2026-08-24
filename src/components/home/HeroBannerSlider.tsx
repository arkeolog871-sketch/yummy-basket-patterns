import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { HeroBannerSlide } from "@/lib/hero-banners";
import { cn } from "@/lib/utils";

function SlideMedia({ slide }: { slide: HeroBannerSlide }) {
  return (
    <>
      <img
        src={slide.imageUrl}
        alt={slide.title || "Kampanya görseli"}
        className="size-full object-cover"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
      {slide.title || slide.subtitle || slide.ctaLabel ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-6">
          {slide.title ? (
            <p className="text-lg font-semibold text-white drop-shadow sm:text-2xl">{slide.title}</p>
          ) : null}
          {slide.subtitle ? (
            <p className="mt-1 max-w-md text-sm text-white/90 drop-shadow">{slide.subtitle}</p>
          ) : null}
          {slide.ctaLabel && slide.href ? (
            <span className="mt-3 inline-flex rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
              {slide.ctaLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function SlideFrame({ slide }: { slide: HeroBannerSlide }) {
  const label = slide.title || "Kampanyayı aç";
  const media = <SlideMedia slide={slide} />;
  if (!slide.href) {
    return <div className="relative size-full">{media}</div>;
  }
  if (slide.href.startsWith("http")) {
    return (
      <a
        href={slide.href}
        className="relative block size-full"
        aria-label={label}
        target="_blank"
        rel="noopener noreferrer"
      >
        {media}
      </a>
    );
  }
  return (
    <Link to={slide.href} className="relative block size-full" aria-label={label}>
      {media}
    </Link>
  );
}

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
  const count = slides.length;
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: count > 1,
    align: "start",
    duration: 22,
    watchDrag: count > 1,
  });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    emblaApi?.reInit();
    emblaApi?.scrollTo(0, true);
  }, [count, emblaApi]);

  const go = useCallback(
    (next: number) => {
      emblaApi?.scrollTo(next);
    },
    [emblaApi],
  );

  useEffect(() => {
    if (!autoplay || paused || count <= 1 || !emblaApi || reduceMotion) return;
    const timer = window.setInterval(() => emblaApi.scrollNext(), intervalMs);
    return () => window.clearInterval(timer);
  }, [autoplay, paused, count, intervalMs, emblaApi, reduceMotion]);

  if (count === 0) return null;

  return (
    <div
      className={cn(
        "hero-banner-slider relative overflow-hidden rounded-3xl border border-border/60 shadow-lifted",
        className,
      )}
      role="region"
      aria-roledescription="carousel"
      aria-label="Kampanya panosu"
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          emblaApi?.scrollPrev();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          emblaApi?.scrollNext();
        }
      }}
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="relative min-w-0 shrink-0 grow-0 basis-full"
              role="group"
              aria-roledescription="slide"
              aria-label={slide.title || "Kampanya"}
            >
              <div className="relative aspect-[16/10] min-h-[220px] w-full bg-muted sm:min-h-[280px]">
                <SlideFrame slide={slide} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background"
            aria-label="Önceki reklam"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className="absolute right-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background"
            aria-label="Sonraki reklam"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
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
          {autoplay && !reduceMotion ? (
            <button
              type="button"
              className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur"
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
