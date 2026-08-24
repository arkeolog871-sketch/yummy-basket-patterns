export type HeroBannerSlide = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  imageUrl: string;
  active: boolean;
};

export type HeroBannersSettings = {
  autoplay: boolean;
  intervalMs: number;
  slides: HeroBannerSlide[];
};

export const MAX_HERO_BANNERS = 8;
export const HERO_INTERVAL_MIN = 3000;
export const HERO_INTERVAL_MAX = 12000;

export const DEFAULT_HERO_BANNERS: HeroBannersSettings = {
  autoplay: true,
  intervalMs: 5000,
  slides: [],
};

export const HERO_BANNERS_SQL = `ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hero_banners jsonb NOT NULL DEFAULT '{"autoplay":true,"intervalMs":5000,"slides":[]}'::jsonb;

COMMENT ON COLUMN public.site_settings.hero_banners IS
  'Kurucu paneli kayan reklam / hero banner slaytları.';

NOTIFY pgrst, 'reload schema';`;

function str(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function sanitizeBannerHref(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value.slice(0, 300);
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString().slice(0, 500);
  } catch {
    /* geçersiz */
  }
  return "";
}

function parseSlide(raw: unknown, index: number): HeroBannerSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row["id"], "", 80) || `slide-${index + 1}`;
  const imageUrl = str(row["imageUrl"], "", 500);
  return {
    id,
    title: str(row["title"], "", 80),
    subtitle: str(row["subtitle"], "", 160),
    ctaLabel: str(row["ctaLabel"], "", 40),
    href: sanitizeBannerHref(typeof row["href"] === "string" ? row["href"] : ""),
    imageUrl,
    active: bool(row["active"], true),
  };
}

export function parseHeroBanners(raw: unknown): HeroBannersSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_HERO_BANNERS, slides: [] };
  const row = raw as Record<string, unknown>;
  const list = Array.isArray(row["slides"]) ? row["slides"] : Array.isArray(raw) ? raw : [];
  const slides = list
    .slice(0, MAX_HERO_BANNERS)
    .map((item, index) => parseSlide(item, index))
    .filter((item): item is HeroBannerSlide => item != null);
  return {
    autoplay: bool(row["autoplay"], DEFAULT_HERO_BANNERS.autoplay),
    intervalMs: num(row["intervalMs"], DEFAULT_HERO_BANNERS.intervalMs, HERO_INTERVAL_MIN, HERO_INTERVAL_MAX),
    slides,
  };
}

export function isHeroBannersColumnPresent(raw: Record<string, unknown> | null | undefined): boolean {
  return Boolean(raw && Object.prototype.hasOwnProperty.call(raw, "hero_banners"));
}

export function publicHeroSlides(
  banners: HeroBannersSettings,
  fallbackBannerUrl: string | null,
): HeroBannerSlide[] {
  const active = banners.slides.filter((slide) => slide.active && slide.imageUrl);
  if (active.length > 0) return active;
  if (fallbackBannerUrl) {
    return [
      {
        id: "legacy-banner",
        title: "",
        subtitle: "",
        ctaLabel: "",
        href: "",
        imageUrl: fallbackBannerUrl,
        active: true,
      },
    ];
  }
  return [];
}

export function createEmptySlide(): HeroBannerSlide {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `slide-${Date.now()}`;
  return {
    id,
    title: "",
    subtitle: "",
    ctaLabel: "İncele",
    href: "/",
    imageUrl: "",
    active: true,
  };
}
