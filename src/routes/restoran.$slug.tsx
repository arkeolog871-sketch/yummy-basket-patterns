import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Star, Clock, Bike, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { restaurantDetailQuery } from "@/lib/catalog.queries";
import { LocationButton } from "@/components/business/LocationButton";
import { BusinessMap } from "@/components/business/BusinessMap";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/format";
import { isBusinessOpen, hoursLabel, closedReason } from "@/lib/hours";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/restoran/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(restaurantDetailQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.restaurant.name, tagline: data.restaurant.tagline };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Restoran bulunamadı — SİLVAN CEBİMDE" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.name} — SİLVAN CEBİMDE`;
    const description = loaderData.tagline ?? `${loaderData.name} menüsünden sipariş verin.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: RestaurantDetail,
  notFoundComponent: RestaurantNotFound,
  errorComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="font-semibold">Restoran şu anda yüklenemedi</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Lütfen sayfayı yenileyin veya birazdan tekrar deneyin.
      </p>
    </div>
  ),
});

function RestaurantNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-2xl">Restoran bulunamadı</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Bu restoran kapanmış veya bağlantı hatalı olabilir.
      </p>
      <Button asChild className="mt-6 rounded-full">
        <Link to="/restoranlar">Restoranlara dön</Link>
      </Button>
    </div>
  );
}

function RestaurantDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(restaurantDetailQuery(slug));
  const cart = useCart();

  if (!data?.restaurant) return <RestaurantNotFound />;
  const restaurant = data.restaurant;
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const items = Array.isArray(data.items) ? data.items : [];
  const open = isBusinessOpen(restaurant);
  const hours = hoursLabel(restaurant);

  const grouped = categories.map((category) => ({
    ...category,
    items: items.filter((item) => item.category_id === category.id),
  }));
  const uncategorised = items.filter((item) => !item.category_id);
  const menuGroups = [
    ...grouped,
    { id: "other", name: "Diğer", position: 999, items: uncategorised },
  ].filter((group) => group.items.length > 0);

  const cartRestaurant = {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    deliveryFee: Number(restaurant.delivery_fee),
    minOrder: Number(restaurant.min_order),
    deliveryMinutes: restaurant.delivery_minutes,
  };

  function add(item: { id: string; name: string; price: number; image_url: string | null }) {
    if (!open) {
      toast.error("İşletme şu an kapalı", { description: closedReason(restaurant) });
      return;
    }
    const switching = cart.restaurant && cart.restaurant.id !== restaurant.id;
    cart.addItem(cartRestaurant, {
      menuItemId: item.id,
      name: item.name,
      price: Number(item.price),
      imageUrl: item.image_url,
    });
    toast.success(`${item.name} sepete eklendi`, {
      description: switching ? "Sepet yeni restorana göre sıfırlandı." : undefined,
    });
  }

  return (
    <div>
      <div className="relative h-56 w-full overflow-hidden sm:h-72">
        {restaurant.cover_image_url ? (
          <img
            src={restaurant.cover_image_url}
            alt={`${restaurant.name} mutfağı`}
            width={1024}
            height={640}
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full bg-warm" />
        )}
        <div className="absolute inset-0 bg-gradient-fade-up" />
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl px-4 pb-6">
          <span className="rounded-full bg-background/90 px-3 py-1 text-xs font-semibold">
            {restaurant.category}
          </span>
          <h1 className="mt-3 text-3xl text-background sm:text-4xl">{restaurant.name}</h1>
          <p className="mt-1 text-sm text-background/80">{restaurant.tagline}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="-mt-6 flex flex-wrap gap-4 rounded-3xl border border-border/70 bg-card p-4 text-sm shadow-card">
          <span className="flex items-center gap-1.5 font-semibold">
            <Star className="size-4 fill-primary text-primary" />
            {Number(restaurant.rating).toFixed(1)}
            <span className="font-normal text-muted-foreground">
              ({restaurant.review_count} değerlendirme)
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-4" /> {restaurant.delivery_minutes} dk
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Bike className="size-4" />
            {Number(restaurant.delivery_fee) === 0
              ? "Ücretsiz teslimat"
              : `${formatPrice(Number(restaurant.delivery_fee))} teslimat`}
          </span>
          <span className="text-muted-foreground">
            Min. sepet {formatPrice(Number(restaurant.min_order))}
          </span>
          {hours ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-4" /> {hours}
            </span>
          ) : null}
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              open ? "bg-success text-success-foreground" : "bg-foreground/85 text-background"
            }`}
          >
            {open ? "Şu An Açık" : "Şu An Kapalı"}
          </span>
          <LocationButton business={restaurant} className="text-muted-foreground" />
        </div>

        {open ? null : (
          <div className="mt-4 rounded-3xl border border-border bg-warm px-4 py-3 text-sm text-warm-foreground">
            {closedReason(restaurant)} Sepete ürün ekleyemezsiniz.
          </div>
        )}

        <div className="grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10">
            {menuGroups.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
                <p className="font-semibold">Bu işletmede şu an menü yok</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ürünler eklendiğinde burada görünecek.
                </p>
              </div>
            ) : (
              menuGroups.map((group) => (
                <section key={group.id}>
                  <h2 className="text-xl">{group.name}</h2>
                  <div className="mt-4 space-y-3">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-card"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-base font-semibold">{item.name}</h3>
                            {item.is_popular ? (
                              <span className="shrink-0 rounded-full bg-warm px-2 py-0.5 text-[11px] font-semibold text-warm-foreground">
                                Popüler
                              </span>
                            ) : null}
                          </div>
                          {item.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          ) : null}
                          <p className="mt-2 font-semibold">{formatPrice(Number(item.price))}</p>
                        </div>
                        <Button
                          size="icon"
                          className="size-10 shrink-0 rounded-full"
                          disabled={!open}
                          aria-label={`${item.name} sepete ekle`}
                          onClick={() => add(item)}
                        >
                          <Plus className="size-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>

          <aside className="h-fit rounded-3xl border border-border/70 bg-card p-5 shadow-card lg:sticky lg:top-24">
            <h2 className="text-lg">Sepetim</h2>
            {cart.lines.length === 0 || cart.restaurant?.id !== restaurant.id ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Sepetiniz bu restoran için henüz boş. Menüden ürün ekleyin.
              </p>
            ) : (
              <>
                <ul className="mt-4 space-y-3 text-sm">
                  {cart.lines.map((line) => (
                    <li key={line.menuItemId} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="font-medium">{line.quantity}×</span> {line.name}
                      </span>
                      <span className="shrink-0 font-medium">
                        {formatPrice(line.price * line.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Ara toplam</span>
                    <span>{formatPrice(cart.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Teslimat</span>
                    <span>{cart.deliveryFee === 0 ? "Ücretsiz" : formatPrice(cart.deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-semibold">
                    <span>Toplam</span>
                    <span>{formatPrice(cart.total)}</span>
                  </div>
                </div>
                <Button asChild className="mt-5 w-full rounded-full">
                  <Link to="/sepet">
                    <ShoppingBag className="size-4" /> Sepete git
                  </Link>
                </Button>
              </>
            )}
          </aside>

          <div className="hidden lg:block">
            <BusinessMap business={restaurant} />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-10 lg:hidden">
        <BusinessMap business={restaurant} />
      </div>
    </div>
  );
}