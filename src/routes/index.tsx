import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { listRestaurants, listCategories } from "@/lib/catalog.functions";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import heroImage from "@/assets/hero-sofra.jpg";

const homeQuery = queryOptions({
  queryKey: ["home-restaurants"],
  queryFn: () => listRestaurants({ data: {} }),
});

const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: () => listCategories(),
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(homeQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: "SofraKapımda — Sıcak yemek, kapınızda" },
      {
        name: "description",
        content:
          "Kebap, pizma, burger, ev yemeği ve tatlı: mahallenin en iyi mutfaklarından sipariş verin, 30 dakikada kapınızda.",
      },
      { property: "og:title", content: "SofraKapımda — Sıcak yemek, kapınızda" },
      {
        property: "og:description",
        content: "Mahallenin en iyi mutfaklarından sipariş verin, dakikalar içinde kapınızda.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: restaurants } = useSuspenseQuery(homeQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();

  return (
    <div>
      <section className="bg-gradient-hero">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Sparkles className="size-3.5" /> 8 restoran, 60+ tabak
            </span>
            <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
              Sofranız hazır, <span className="text-accent">kapınıza geliyor</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground">
              Meşe kömüründe kebaptan taş fırın pizzaya, annenizin yemeğinden fıstıklı baklavaya:
              hepsi tek uygulamada.
            </p>

            <form
              className="mt-7 flex max-w-md gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                navigate({ to: "/restoranlar", search: term.trim() ? { q: term.trim() } : {} });
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="Restoran veya mutfak ara"
                  aria-label="Restoran ara"
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
        <h2 className="text-2xl">Ne yemek istersiniz?</h2>
        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => (
            <Link
              key={category.name}
              to="/restoranlar"
              search={{ kategori: category.name }}
              className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-card transition-colors hover:bg-warm hover:text-warm-foreground"
            >
              {category.name}
              <span className="ml-2 text-xs text-muted-foreground">{category.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl">Öne çıkan restoranlar</h2>
          <Button asChild variant="ghost" className="rounded-full">
            <Link to="/restoranlar">Tümünü gör</Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.slice(0, 6).map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>
      </section>
    </div>
  );
}
