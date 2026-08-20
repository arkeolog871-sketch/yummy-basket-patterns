import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { BusinessCard } from "@/components/business/BusinessCard";
import { MOCK_BUSINESSES, SECTORS, isSectorSlug, type SectorSlug } from "@/lib/sectors";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import heroImage from "@/assets/hero-sofra.jpg";

type HomeSearch = { kategori?: SectorSlug | undefined; q?: string | undefined };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    kategori: isSectorSlug(search["kategori"]) ? search["kategori"] : undefined,
    q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "SofraKapımda — Yemek, market, kafe ve daha fazlası" },
      {
        name: "description",
        content:
          "Yemek, restoran, kafe, eğlence, market ve giyim: mahallenizdeki tüm işletmeler tek uygulamada, dakikalar içinde kapınızda.",
      },
      { property: "og:title", content: "SofraKapımda — Yemek, market, kafe ve daha fazlası" },
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
  const { settings } = useSiteSettings();
  const [term, setTerm] = useState(search.q ?? "");
  const activeSector = search.kategori;

  const gridClass =
    settings.layout_variant === "compact"
      ? "mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      : settings.layout_variant === "spotlight"
        ? "mt-7 grid gap-6 lg:grid-cols-2"
        : "mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

  const results = useMemo(() => {
    const q = (search.q ?? "").toLocaleLowerCase("tr");
    return MOCK_BUSINESSES.filter((business) => {
      if (activeSector && business.sector !== activeSector) return false;
      if (!q) return true;
      return [business.name, business.tagline, business.district, ...business.tags]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q);
    });
  }, [activeSector, search.q]);

  function apply(next: HomeSearch) {
    navigate({ to: "/", search: next });
  }

  return (
    <div>
      <section className="bg-gradient-hero">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Sparkles className="size-3.5" /> 8 restoran, 60+ tabak
            </span>
            <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
              Mahalleniz hazır, <span className="text-accent">kapınıza geliyor</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground">
              Yemek, restoran, kafe, eğlence, market ve giyim: mahallenizdeki tüm işletmeler tek
              uygulamada.
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

          <div className="relative">
            <img
              src={heroImage}
              alt="Türk mutfağından kebap, lahmacun ve mezelerle dolu bir sofra"
              width={1024}
              height={768}
              className="aspect-[4/3] w-full rounded-4xl object-cover shadow-lifted"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl">
              {activeSector
                ? SECTORS.find((sector) => sector.slug === activeSector)?.label
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
          {SECTORS.map((sector) => {
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
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
