import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import {
  BANNER_AUTOPLAY_MS,
  BANNER_IMPRESSION_MS,
  trackBanner,
  type PublicBanner,
} from "@/lib/advertisements";
import { cn } from "@/lib/utils";
import { AdMedia } from "@/components/home/AdMedia";

function activateBanner(banner: PublicBanner, navigate: ReturnType<typeof useNavigate>) {
  trackBanner(banner.id, "click");
  const value = banner.action_value;
  if (!value) return;
  if (banner.action_type === "phone") {
    window.location.href = `tel:${value}`;
    return;
  }
  if (banner.action_type === "external_link") {
    window.open(value, "_blank", "noopener,noreferrer");
    return;
  }
  void navigate({ to: value as never });
}

function SlideVisual({ banner, priority, active }: { banner: PublicBanner; priority: boolean; active: boolean }) {
  return (
    <>
      <AdMedia src={banner.image_url} alt={banner.title || "Reklam"} priority={priority} active={active} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      {banner.title ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <p className="text-base font-semibold text-white drop-shadow sm:text-lg">{banner.title}</p>
        </div>
      ) : null}
    </>
  );
}

export function HeroBannerSlider({
  banners,
  className,
  preview = false,
  onActivate,
}: {
  banners: PublicBanner[];
  className?: string;
  /** Kurucu önizleme: tıklama takibi ve tel/navigasyon yok. */
  preview?: boolean;
  onActivate?: (banner: PublicBanner) => void;
}) {
  const navigate = useNavigate();

  const trigger = useCallback(
    (banner: PublicBanner) => {
      if (preview) {
        onActivate?.(banner);
        return;
      }
      onActivate?.(banner);
      activateBanner(banner, navigate);
    },
    [preview, onActivate, navigate],
  );
  const count = banners.length;
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: count > 1,
    align: "center",
    skipSnaps: false,
    containScroll: false,
    duration: 22,
    watchDrag: count > 1,
  });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const holding = useRef(false);
  const seen = useRef(new Set<string>());

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

  useEffect(() => {
    if (paused || holding.current || count <= 1 || !emblaApi) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => emblaApi.scrollNext(), BANNER_AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, count, emblaApi, index]);

  const current = banners[index];
  useEffect(() => {
    if (preview || !current?.id || seen.current.has(current.id)) return;
    const timer = window.setTimeout(() => {
      seen.current.add(current.id);
      trackBanner(current.id, "impression");
    }, BANNER_IMPRESSION_MS);
    return () => window.clearTimeout(timer);
  }, [current?.id, preview]);

  const hold = useCallback((down: boolean) => {
    holding.current = down;
    setPaused(down);
  }, []);

  if (count === 0) return null;

  return (
    <div
      className={cn(
        "hero-banner-slider relative overflow-hidden rounded-3xl border border-border/60 shadow-lifted",
        className,
      )}
      role="region"
      aria-roledescription="carousel"
      aria-label="Kayan reklam panosu"
      tabIndex={0}
      onPointerDown={() => hold(true)}
      onPointerUp={() => hold(false)}
      onPointerCancel={() => hold(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          emblaApi?.scrollPrev();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          emblaApi?.scrollNext();
        }
        if (event.key === "Enter" && current) {
          event.preventDefault();
          trigger(current);
        }
      }}
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {banners.map((banner, i) => (
            <div
              key={banner.id}
              className="relative min-w-0 shrink-0 grow-0 basis-[85%] px-1.5 sm:basis-[86%]"
              role="group"
              aria-roledescription="slide"
              aria-label={banner.title || `Reklam ${i + 1}`}
            >
              <button
                type="button"
                className="relative block w-full overflow-hidden rounded-2xl text-left"
                onClick={() => trigger(banner)}
              >
                <div className="relative aspect-video max-h-[240px] w-full bg-muted sm:aspect-[3/1] sm:max-h-[280px]">
                  <SlideVisual banner={banner} priority={i === 0} active={i === index} />
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background sm:left-3"
            aria-label="Önceki reklam"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background sm:right-3"
            aria-label="Sonraki reklam"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                aria-label={`${i + 1}. reklam`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
                onClick={() => emblaApi?.scrollTo(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur"
            aria-label={paused ? "Otomatik kaydırmayı başlat" : "Otomatik kaydırmayı durdur"}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
        </>
      ) : null}
    </div>
  );
}

/** Eski JSONB slaytlarını public banner şekline çevirir (yedek). */
export function legacySlidesToBanners(
  slides: { id: string; title: string; imageUrl: string; href: string }[],
): PublicBanner[] {
  return slides.map((slide, index) => {
    const href = slide.href.trim();
    const action_type = href.startsWith("http")
      ? "external_link"
      : href.startsWith("tel:")
        ? "phone"
        : "internal_route";
    const action_value =
      action_type === "phone" ? href.replace(/^tel:/, "") : href || "/";
    return {
      id: slide.id,
      title: slide.title,
      image_url: slide.imageUrl,
      action_type,
      action_value,
      display_order: index,
    };
  });
}
