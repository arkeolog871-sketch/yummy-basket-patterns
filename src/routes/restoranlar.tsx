import { createFileRoute, useNavigate, ClientOnly } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState, Suspense, lazy } from "react";
import { Search } from "lucide-react";
import {
  restaurantsQuery,
  categoriesQuery,
  type RestoranSearch,
} from "@/lib/catalog.queries";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const AllBusinessesMap = lazy(() => import("@/components/business/AllBusinessesMap"));

export const Route = createFileRoute("/restoranlar")({
  validateSearch: (search: Record<string, unknown>): RestoranSearch => ({
    q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
    kategori:
      typeof search["kategori"] === "string" && search["kategori"] ? search["kategori"] : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(restaurantsQuery(deps)),
      context.queryClient.ensureQueryData(categoriesQuery),
    ]);
  },
  errorComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="font-semibold">Restoranlar şu anda yüklenemedi</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Lütfen sayfayı yenileyin veya birazdan tekrar deneyin.
      </p>
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Restoranlar — SİLVAN CEBİMDE" },
      {
        name: "description",
        content: "Kategoriye göre filtreleyin, arama yapın ve mahallenizin en iyi mutfaklarını keşfedin.",
      },
      { property: "og:title", content: "Restoranlar — SİLVAN CEBİMDE" },
      {
        property: "og:description",
        content: "Kategoriye göre filtreleyin ve mahallenizin en iyi mutfaklarını keşfedin.",
      },
    ],
  }),
  component: RestaurantsPage,
});

function RestaurantsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: restaurants } = useSuspenseQuery(restaurantsQuery(search));
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const [term, setTerm] = useState(search.q ?? "");

  useEffect(() => setTerm(search.q ?? ""), [search.q]);

  function apply(next: RestoranSearch) {
    navigate({ search: next });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl">Restoranlar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {restaurants.length} restoran listeleniyor
      </p>

      <form
        className="mt-6 flex max-w-xl gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: term.trim() || undefined, kategori: search.kategori });
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Restoran, mutfak veya yemek ara"
            aria-label="Restoran ara"
            className="h-11 rounded-full bg-card pl-9"
          />
        </div>
        <Button type="submit" className="h-11 rounded-full px-6">
          Ara
        </Button>
      </form>

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => apply({ q: search.q })}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            search.kategori
              ? "border-border bg-card hover:bg-warm hover:text-warm-foreground"
              : "border-transparent bg-primary text-primary-foreground"
          }`}
        >
          Tümü
        </button>
        {categories.map((category) => {
          const active = search.kategori === category.name;
          return (
            <button
              key={category.name}
              type="button"
              onClick={() =>
                apply({ q: search.q, kategori: active ? undefined : category.name })
              }
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-warm hover:text-warm-foreground"
              }`}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <AllBusinessesMap businesses={restaurants} />
          </Suspense>
        </ClientOnly>
      </div>

      {restaurants.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-semibold">Aramanıza uygun restoran bulamadık</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Farklı bir kelime deneyin veya kategori filtresini kaldırın.
          </p>
          <Button className="mt-5 rounded-full" onClick={() => apply({})}>
            Filtreleri temizle
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>
      )}
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
