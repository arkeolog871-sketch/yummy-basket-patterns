import { createFileRoute, useNavigate, ClientOnly } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState, Suspense, lazy } from "react";
import { Search, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { homeQuery, type HomeSearch } from "@/lib/catalog.queries";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { fetchPublicBanners } from "@/lib/advertisements";
import { HeroBannerSlider, legacySlidesToBanners } from "@/components/home/HeroBannerSlider";
import { useAppCategories } from "@/hooks/useTaxonomy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AllBusinessesMap = lazy(() => import("@/components/business/AllBusinessesMap"));

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    kategori:
      typeof search["kategori"] === "string" && /^[a-z0-9-]{2,40}$/.test(search["kategori"])
        ? search["kategori"]
        : undefined,
    q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    try {
      await context.queryClient.ensureQueryData(homeQuery(deps));
    } catch {
      console.error("[catalog] ana sayfa yüklenemedi");
      context.queryClient.setQueryData(homeQuery(deps).queryKey, []);
    }
  },
  errorComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="font-semibold">İşletmeler şu anda yüklenemedi</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Lütfen sayfayı yenileyin veya birazdan tekrar deneyin.
      </p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="font-semibold">Sayfa bulunamadı</p>
    </div>
  ),
  head: () => ({
    meta: [
      { title: "SİLVAN CEBİMDE — Yemek, market, kafe ve daha fazlası" },
      {
        name: "description",
        content:
          "Yemek, restoran, kafe, eğlence, market ve giyim: mahallenizdeki tüm işletmeler tek uygulamada, dakikalar içinde kapınızda.",
      },
      { property: "og:title", content: "SİLVAN CEBİMDE — Yemek, market, kafe ve daha fazlası" },
      {
        property: "og:description",
        content: "Mahallenizdeki tüm işletmeler tek uygulamada, dakikalar içinde kapınızda.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { settings, hero } = useSiteSettings();
  const { categories } = useAppCategories();
  const { data: results } = useSuspenseQuery(homeQuery(search));
  const bannersQuery = useQuery({
    queryKey: ["public-banners"],
    queryFn: fetchPublicBanners,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const [term, setTerm] = useState(search.q ?? "");
  const activeSector = search.kategori;
  const liveBanners = bannersQuery.data && bannersQuery.data.length > 0 ? bannersQuery.data : [];
  const bannerSlides = liveBanners.length
    ? liveBanners
    : settings.banner_url
      ? legacySlidesToBanners([{ id: "banner", title: "", imageUrl: settings.banner_url, href: "/" }])
      : [];

  useEffect(() => setTerm(search.q ?? ""), [search.q]);

  const gridClass =
    settings.layout_variant === "compact"
      ? "mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      : settings.layout_variant === "spotlight"
        ? "mt-7 grid gap-6 lg:grid-cols-2"
        : "mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

  function apply(next: HomeSearch) {
    navigate({ to: "/", search: next });
  }

  return (
    <div>
      <section className="bg-gradient-hero">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 lg:py-20">
          <div
            className={
              bannerSlides.length > 0
                ? "grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
                : undefined
            }
          >
            <div className={bannerSlides.length > 0 ? "order-2 lg:order-1" : undefined}>
            <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Sparkles className="size-3.5" /> {results.length} {hero.hero_badge}
            </span>
            <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
              {hero.hero_title}{" "}
              {hero.hero_title_accent ? (
                <span className="text-accent">{hero.hero_title_accent}</span>
              ) : null}
            </h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground">
              {hero.hero_subtitle}
            </p>

            <form
              className="mt-7 flex max-w-md gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                apply({ kategori: activeSector, q: term.trim() || undefined });
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={term}
                  name="q"
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="İşletme, mutfak veya ürün ara"
                  aria-label="İşletme ara"
                  className="h-12 rounded-full bg-card pl-9"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 rounded-full px-6">
                Ara
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap gap-5 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Clock className="size-4" /> Ortalama 30 dk teslimat
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4" /> Güvenli ödeme
              </span>
            </div>
            </div>
            {bannerSlides.length > 0 ? (
              <div className="order-1 lg:order-2">
                <HeroBannerSlider banners={bannerSlides} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl">
              {activeSector
                ? (categories.find((sector) => sector.slug === activeSector)?.label ?? activeSector)
                : "Tüm işletmeler"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {results.length} işletme listeleniyor
              {search.q ? ` · “${search.q}” için` : ""}
            </p>
          </div>
        </div>

        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => apply({ q: search.q })}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              activeSector
                ? "border-border bg-card hover:bg-warm hover:text-warm-foreground"
                : "border-transparent bg-primary text-primary-foreground"
            }`}
          >
            Tümü
          </button>
          {categories.map((sector) => {
            const active = activeSector === sector.slug;
            return (
              <button
                key={sector.slug}
                type="button"
                onClick={() =>
                  apply({ q: search.q, kategori: active ? undefined : sector.slug })
                }
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-warm hover:text-warm-foreground"
                }`}
              >
                {sector.label}
              </button>
            );
          })}
        </div>

        {results.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-semibold">Aramanıza uygun işletme bulamadık</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Farklı bir kelime deneyin veya kategori filtresini kaldırın.
            </p>
            <Button
              className="mt-5 rounded-full"
              onClick={() => {
                setTerm("");
                apply({});
              }}
            >
              Filtreleri temizle
            </Button>
          </div>
        ) : (
          <div className={gridClass}>
            {results.map((business) => (
              <RestaurantCard key={business.id} restaurant={business} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <AllBusinessesMap businesses={results} />
          </Suspense>
        </ClientOnly>
      </section>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <div className="size-4 rounded-full bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
      <div className="mt-3 h-[360px] animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
