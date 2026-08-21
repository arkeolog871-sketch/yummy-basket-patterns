import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sepet")({
  head: () => ({
    meta: [
      { title: "Sepetim — SİLVAN CEBİMDE" },
      { name: "description", content: "Sepetinizi düzenleyin ve siparişinizi tamamlayın." },
      { property: "og:title", content: "Sepetim — SİLVAN CEBİMDE" },
      { property: "og:description", content: "Sepetinizi düzenleyin ve siparişinizi tamamlayın." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  const { user } = useAuth();

  if (cart.lines.length === 0 || !cart.restaurant) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-3xl">Sepetiniz boş</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Mahallenin en iyi mutfaklarına göz atın ve favori tabaklarınızı ekleyin.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/restoranlar">Restoranları keşfet</Link>
        </Button>
      </div>
    );
  }

  const missing = Math.max(0, cart.restaurant.minOrder - cart.subtotal);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl">Sepetim</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link
          to="/restoran/$slug"
          params={{ slug: cart.restaurant.slug }}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {cart.restaurant.name}
        </Link>{" "}
        · yaklaşık {cart.restaurant.deliveryMinutes} dk
      </p>

      <div className="mt-6 space-y-3">
        {cart.lines.map((line) => (
          <div
            key={line.menuItemId}
            className="flex items-center gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-card"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{line.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatPrice(line.price)} / adet</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="size-9 rounded-full"
                aria-label="Azalt"
                onClick={() => cart.setQuantity(line.menuItemId, line.quantity - 1)}
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-6 text-center font-semibold">{line.quantity}</span>
              <Button
                size="icon"
                variant="outline"
                className="size-9 rounded-full"
                aria-label="Artır"
                onClick={() => cart.setQuantity(line.menuItemId, line.quantity + 1)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <p className="w-24 shrink-0 text-right font-semibold">
              {formatPrice(line.price * line.quantity)}
            </p>
            <Button
              size="icon"
              variant="ghost"
              className="size-9 rounded-full text-muted-foreground"
              aria-label={`${line.name} ürününü kaldır`}
              onClick={() => cart.removeItem(line.menuItemId)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Ara toplam</span>
            <span>{formatPrice(cart.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Teslimat ücreti</span>
            <span>{cart.deliveryFee === 0 ? "Ücretsiz" : formatPrice(cart.deliveryFee)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
            <span>Toplam</span>
            <span>{formatPrice(cart.total)}</span>
          </div>
        </div>

        {missing > 0 ? (
          <p className="mt-4 rounded-2xl bg-warm px-4 py-3 text-sm text-warm-foreground">
            Minimum sepet tutarına {formatPrice(missing)} kaldı.
          </p>
        ) : null}

        <Button asChild disabled={missing > 0} className="mt-5 w-full rounded-full" size="lg">
          {user ? (
            <Link to="/odeme">Ödemeye geç</Link>
          ) : (
            <Link to="/auth" search={{ redirect: "/odeme" }}>
              Giriş yap ve devam et
            </Link>
          )}
        </Button>
      </div>
    </div>
  );
}