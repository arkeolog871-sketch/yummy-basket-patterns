import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { listAddresses } from "@/lib/addresses.functions";
import { createOrder } from "@/lib/orders.functions";
import { useCart } from "@/hooks/useCart";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { formatPrice } from "@/lib/format";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/odeme")({
  head: () => ({
    meta: [
      { title: "Ödeme ve sipariş onayı — SİLVAN CEBİMDE" },
      { name: "description", content: "Teslimat adresinizi seçin, sipariş notunuzu ekleyin ve siparişinizi onaylayın." },
      { property: "og:title", content: "Ödeme ve sipariş onayı — SİLVAN CEBİMDE" },
      { property: "og:description", content: "Adresinizi seçin ve siparişinizi tamamlayın." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireAuth requireVerified>
      <CheckoutPage />
    </RequireAuth>
  ),
});

function CheckoutPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const fetchAddresses = useServerFn(listAddresses);
  const submitOrder = useServerFn(createOrder);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
  );

  const { data: addresses = [], isLoading, isError } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => fetchAddresses(),
  });

  useEffect(() => {
    if (!selectedId && addresses.length > 0) setSelectedId(addresses[0]!.id);
  }, [addresses, selectedId]);

  const place = useMutation({
    mutationFn: async () => {
      submittingRef.current = true;
      const address = addresses.find((item) => item.id === selectedId);
      if (!address || !cart.restaurant) throw new Error("Adres veya sepet eksik.");
      const result = await submitOrder({
        data: {
          restaurant_id: cart.restaurant.id,
          items: cart.lines.map((line) => ({
            menu_item_id: line.menuItemId,
            quantity: line.quantity,
          })),
          recipient_name: address.recipient_name,
          phone: address.phone,
          city: address.city,
          district: address.district,
          street: address.street,
          directions: address.directions,
          note: note || null,
          idempotency_key: idempotencyKeyRef.current,
        },
      });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
      cart.clear();
      toast.success("Siparişiniz alındı!");
      navigate({ to: "/siparis/$id", params: { id: result.id } });
    },
    onError: (error) => toast.error(toPublicErrorMessage(error, "Sipariş oluşturulamadı.")),
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  if (cart.lines.length === 0 || !cart.restaurant) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-3xl">Sepetiniz boş</h1>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/restoranlar">Restoranları keşfet</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl">Ödeme</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {cart.restaurant.name} · yaklaşık {cart.restaurant.deliveryMinutes} dk
      </p>

      <div className="mt-6 space-y-3">
        <p className="font-semibold">Teslimat adresi</p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">Adresler yüklenemedi. Sayfayı yenileyip tekrar deneyin.</p>
        ) : addresses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Önce bir teslimat adresi ekleyin.</p>
            <Button asChild className="mt-4 rounded-full">
              <Link to="/adreslerim">Adres ekle</Link>
            </Button>
          </div>
        ) : (
          addresses.map((address) => (
            <label
              key={address.id}
              className={`flex cursor-pointer items-start gap-3 rounded-3xl border bg-card p-4 shadow-card ${
                selectedId === address.id ? "border-primary" : "border-border/70"
              }`}
            >
              <input
                type="radio"
                name="address"
                className="mt-1"
                checked={selectedId === address.id}
                onChange={() => setSelectedId(address.id)}
              />
              <span className="text-sm">
                <span className="block font-semibold">{address.label}</span>
                <span className="block text-muted-foreground">
                  {address.recipient_name} · {address.phone}
                </span>
                <span className="block text-muted-foreground">
                  {address.street}, {address.district}/{address.city}
                </span>
              </span>
            </label>
          ))
        )}
      </div>

      <div className="mt-6 space-y-2">
        <p className="font-semibold">Sipariş notu</p>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Kapı zili çalışmıyor, arayabilirsiniz."
          className="rounded-2xl"
        />
      </div>

      <div className="mt-6 space-y-3">
        <p className="font-semibold">Ödeme yöntemi</p>
        <div className="flex items-start gap-3 rounded-3xl border border-primary bg-card p-4 shadow-card">
          <input type="radio" name="payment" className="mt-1" checked readOnly />
          <span className="text-sm">
            <span className="block font-semibold">Kapıda ödeme</span>
            <span className="block text-muted-foreground">
              Siparişinizi kurye teslim ederken nakit veya kredi kartıyla ödeyebilirsiniz. Şu an tek ödeme
              yöntemimiz kapıda ödemedir.
            </span>
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
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
        <p className="mt-3 text-xs text-muted-foreground">Ödeme: kapıda ödeme</p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Siparişi onayladığınızda toplam tutarı ödeme yükümlülüğü doğar. Ödemeyi kurye teslim
          sırasında nakit veya kredi kartıyla yaparsınız; sipariş, seçtiğiniz işletme tarafından
          hazırlanır. İptal, cayma hakkı ve iade koşulları için{" "}
          <Link to="/iptal-ve-iade" className="underline underline-offset-4">
            İptal ve İade Politikası
          </Link>{" "}
          sayfasını inceleyin.
        </p>
        <Button
          className="mt-5 w-full rounded-full"
          size="lg"
          disabled={!selectedId || place.isPending || !cart.meetsMinimum}
          onClick={() => {
            if (place.isPending || submittingRef.current) return;
            place.mutate();
          }}
        >
          {place.isPending ? "Sipariş gönderiliyor…" : "Siparişi onayla · Kapıda ödeme"}
        </Button>
      </div>
    </div>
  );
}