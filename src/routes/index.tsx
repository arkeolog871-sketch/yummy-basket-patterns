import { createFileRoute, useNavigate, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, Suspense, lazy } from "react";
import { Search, Sparkles } from "lucide-react";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { homeQuery, type HomeSearch } from "@/lib/catalog.queries";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { categoryChipText } from "@/lib/category-colors";
import { seedFromHex, themeBackgroundHex } from "@/lib/theme-palette";
import { fetchPublicBanners } from "@/lib/advertisements";
import { HeroBannerSlider, legacySlidesToBanners } from "@/components/home/HeroBannerSlider";
import { FounderContact } from "@/components/home/FounderContact";
import { useAppCategories } from "@/hooks/useTaxonomy";
import { interpretSmartSearch } from "@/lib/ai-search.functions";
import { AI_UI_ENABLED } from "@/lib/ai-features";
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
      // Sonuç DÖNDÜRÜLÜR: yükleyici verisi sunucudan istemciye taşınır, sorgu
      // önbelleği taşınmaz. Döndürülmezse istemci hidrasyonda listeyi
      // "yükleniyor" sanıyor, sunucu "N işletme listeleniyor" basmış oluyor:
      // React #418 (ölçüldü, canlı: ana sayfada her açılışta).
      const businesses = await context.queryClient.ensureQueryData(homeQuery(deps));
      return { businesses, loadedAt: Date.now() };
    } catch {
      // Hatada boş liste yazma: istemci "boş ama taze" sanıp yeniden denemez.
      // Önbelleği boş bırak, bileşen hata kartını gösterip yeniden dener.
      console.error("[catalog] ana sayfa yüklenemedi");
      return { businesses: undefined, loadedAt: 0 };
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
  const { settings, isDark } = useSiteSettings();
  const pageBackground = themeBackgroundHex(
    seedFromHex(settings.primary_color),
    isDark ? "dark" : "light",
  );
  const { categories } = useAppCategories();
  const loaderData = Route.useLoaderData();
  const homeQueryResult = useQuery({
    ...homeQuery(search),
    // Sunucunun yüklediği liste hidrasyonda hazır olsun (bkz. loader).
    initialData: () => loaderData?.businesses,
    initialDataUpdatedAt: () => loaderData?.loadedAt,
    // Yükleme başarısızsa sessizce boş liste gösterme: birkaç kez otomatik dene,
    // olmazsa kullanıcıya hata kartı + "Tekrar dene" göster.
    retry: 2,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const results = homeQueryResult.data ?? [];
  const loadingFirst = homeQueryResult.isPending;
  const loadFailed = homeQueryResult.isError && results.length === 0;
  const bannersQuery = useQuery({
    queryKey: ["public-banners"],
    queryFn: fetchPublicBanners,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const [term, setTerm] = useState(search.q ?? "");
  const [thinking, setThinking] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const interpret = useServerFn(interpretSmartSearch);
  const activeSector = search.kategori;
  const liveBanners = bannersQuery.data && bannersQuery.data.length > 0 ? bannersQuery.data : [];
  const bannerSlides = liveBanners.length
    ? liveBanners
    : settings.banner_url
      ? legacySlidesToBanners([
          { id: "banner", title: "", imageUrl: settings.banner_url, href: "/" },
        ])
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

  /**
   * Akıllı arama: "ucuz kahvaltı" gibi serbest cümleler yapay zekâ ile
   * kategori + anahtar kelimeye çevrilir. Tek kelimelik aramalar (marka/ürün
   * adı) doğrudan normal aramaya gider; yapay zekâ yanıt vermezse de normal
   * arama çalışır — arama hiçbir koşulda yapay zekâya bağımlı değildir.
   */
  async function runSearch() {
    const raw = term.trim();
    setAiNote(null);
    if (!raw) {
      apply({ kategori: activeSector });
      return;
    }
    const looksLikeSentence = raw.split(/\s+/).length >= 2;
    if (!looksLikeSentence || !AI_UI_ENABLED) {
      apply({ kategori: activeSector, q: raw });
      return;
    }

    setThinking(true);
    try {
      const { intent } = await interpret({
        data: {
          query: raw,
          sectors: categories.map((sector) => ({ slug: sector.slug, label: sector.label })),
        },
      });
      if (intent && (intent.sector || intent.keywords)) {
        setAiNote(intent.note ?? null);
        apply({
          kategori: intent.sector ?? activeSector,
          q: intent.keywords ?? raw,
        });
        return;
      }
    } catch {
      // Yapay zekâ yanıt vermedi; normal aramaya düşülür.
    } finally {
      setThinking(false);
    }
    apply({ kategori: activeSector, q: raw });
  }

  return (
    <div>
      <section className="bg-gradient-hero">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:py-8">
          <div
            className={
              bannerSlides.length > 0
                ? "grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
                : undefined
            }
          >
            <div className={bannerSlides.length > 0 ? "order-2 lg:order-1" : undefined}>
              <form
                className="max-w-md"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runSearch();
                }}
              >
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={term}
                      name="q"
                      onChange={(event) => setTerm(event.target.value)}
                      placeholder="Ne arıyorsunuz? Örn. ucuz kahvaltı yapan kafe"
                      aria-label="İşletme ara"
                      className="h-12 rounded-full bg-card pl-9"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 rounded-full px-6"
                    disabled={thinking}
                  >
                    {thinking ? "Anlıyor…" : "Ara"}
                  </Button>
                </div>
                {aiNote ? (
                  <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                    <Sparkles className="mt-0.5 size-4 shrink-0" />
                    <span>{aiNote}</span>
                  </p>
                ) : null}
              </form>
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
            {!loadFailed && !loadingFirst ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {results.length} işletme listeleniyor
                {search.q ? ` · “${search.q}” için` : ""}
              </p>
            ) : null}
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
            const color = sector.color;
            // Koyu temada kategori rengi koyu zeminde okunmaz; aynı ton açılır.
            const text = color ? categoryChipText(color, pageBackground) : undefined;
            return (
              <button
                key={sector.slug}
                type="button"
                onClick={() => apply({ q: search.q, kategori: active ? undefined : sector.slug })}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  color
                    ? ""
                    : active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-warm hover:text-warm-foreground"
                }`}
                style={
                  color
                    ? active
                      ? { backgroundColor: color, borderColor: color, color: "#fff" }
                      : { backgroundColor: `${color}1a`, borderColor: `${text}55`, color: text }
                    : undefined
                }
              >
                {sector.label}
              </button>
            );
          })}
        </div>

        {loadingFirst ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        ) : loadFailed ? (
          <div className="mt-10 rounded-3xl border border-destructive/30 bg-card p-10 text-center">
            <p className="font-semibold">İşletmeler yüklenemedi</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Bağlantı sorunu nedeniyle işletme listesi alınamadı. Birkaç kez otomatik olarak
              yeniden denedik; isterseniz şimdi tekrar deneyin.
            </p>
            <Button
              className="mt-5 rounded-full"
              onClick={() => void homeQueryResult.refetch()}
              disabled={homeQueryResult.isFetching}
            >
              {homeQueryResult.isFetching ? "Yeniden deneniyor…" : "Tekrar dene"}
            </Button>
          </div>
        ) : results.length === 0 ? (
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
          <>
            {homeQueryResult.isError ? (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-card px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  Liste güncellenemedi, eski liste gösteriliyor.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => void homeQueryResult.refetch()}
                  disabled={homeQueryResult.isFetching}
                >
                  {homeQueryResult.isFetching ? "Deneniyor…" : "Tekrar dene"}
                </Button>
              </div>
            ) : null}
            <div className={gridClass}>
              {results.map((business) => (
                <RestaurantCard
                  key={business.id}
                  restaurant={business}
                  categoryColor={
                    categories.find((sector) => sector.slug === business.sector)?.color
                  }
                />
              ))}
            </div>
          </>
        )}
      </section>

      {results.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 pb-16">
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <AllBusinessesMap businesses={results} />
            </Suspense>
          </ClientOnly>
        </section>
      ) : null}

      <FounderContact />
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
