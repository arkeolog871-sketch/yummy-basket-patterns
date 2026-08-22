import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyOrder } from "@/lib/orders.functions";
import { RequireAuth } from "@/components/auth/RequireAuth";
import {
  formatPrice,
  formatDateTime,
  ORDER_STATUS_LABELS,
  ORDER_TRACK_STEPS,
  orderStepIndex,
} from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/siparis/$id")({
  head: () => ({
    meta: [
      { title: "Sipariş durumu — SİLVAN CEBİMDE" },
      { name: "description", content: "Siparişinizin hazırlanma ve teslimat durumunu adım adım takip edin." },
      { property: "og:title", content: "Sipariş durumu — SİLVAN CEBİMDE" },
      { property: "og:description", content: "Siparişinizin durumunu canlı olarak takip edin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <OrderDetailPage />
    </RequireAuth>
  ),
});

function OrderDetailPage() {
  const { id } = Route.useParams();
  const fetchOrder = useServerFn(getMyOrder);
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder({ data: { id } }),
    refetchInterval: 10000,
  });

  if (isLoading) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  if (isError || !order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-3xl">Sipariş bulunamadı</h1>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/siparislerim">Siparişlerime dön</Link>
        </Button>
      </div>
    );
  }

  const cancelled = order.status === "cancelled";
  const currentIndex = orderStepIndex(order.status);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-3xl">{order.restaurants?.name ?? "Siparişiniz"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatDateTime(order.created_at)} · {ORDER_STATUS_LABELS[order.status] ?? order.status}
      </p>

      {cancelled ? (
        <div className="mt-6 rounded-3xl border border-destructive/40 bg-card p-5 text-sm shadow-card">
          <p className="font-semibold text-destructive">Sipariş iptal edildi</p>
          <p className="mt-1 text-muted-foreground">
            Bu sipariş iptal edildiği için takip adımları görüntülenmiyor.
          </p>
        </div>
      ) : (
        <ol className="mt-6 flex gap-2 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
          {ORDER_TRACK_STEPS.map((step, index) => {
            const done = index <= currentIndex;
            const active = index === currentIndex;
            return (
              <li key={step.label} className="flex-1">
                <span
                  className={`block h-1.5 rounded-full ${done ? "bg-primary" : "bg-border"}`}
                  aria-hidden
                />
                <span
                  className={`mt-2 block text-xs sm:text-sm ${
                    active
                      ? "font-semibold text-primary"
                      : done
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-6 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <p className="font-semibold">Sipariş içeriği</p>
        <div className="mt-3 space-y-2 text-sm">
          {(order.order_items ?? []).map((line) => (
            <div key={line.id} className="flex justify-between text-muted-foreground">
              <span>
                {line.quantity} × {line.name}
              </span>
              <span>{formatPrice(Number(line.unit_price) * line.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between text-muted-foreground">
            <span>Teslimat ücreti</span>
            <span>{formatPrice(Number(order.delivery_fee))}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
            <span>Toplam</span>
            <span>{formatPrice(Number(order.total))}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-border/70 bg-card p-5 text-sm shadow-card">
        <p className="font-semibold">Teslimat adresi</p>
        <p className="mt-2 text-muted-foreground">
          {order.recipient_name} · {order.phone}
        </p>
        <p className="text-muted-foreground">
          {order.street}, {order.district}/{order.city}
        </p>
      </div>
    </div>
  );
}