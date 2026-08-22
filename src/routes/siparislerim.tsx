import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyOrders } from "@/lib/orders.functions";
import { RequireAuth } from "@/components/auth/RequireAuth";
import {
  formatPrice,
  formatDateTime,
  ORDER_STATUS_LABELS,
  ORDER_TRACK_STEPS,
  orderStepIndex,
} from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/siparislerim")({
  head: () => ({
    meta: [
      { title: "Siparişlerim — SİLVAN CEBİMDE" },
      { name: "description", content: "Geçmiş ve devam eden SİLVAN CEBİMDE siparişlerinizi görüntüleyin." },
      { property: "og:title", content: "Siparişlerim — SİLVAN CEBİMDE" },
      { property: "og:description", content: "Sipariş geçmişinizi ve durumlarını takip edin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <OrdersPage />
    </RequireAuth>
  ),
});

function OrdersPage() {
  const fetchOrders = useServerFn(listMyOrders);
  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchOrders(),
    refetchInterval: 15000,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl">Siparişlerim</h1>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : isError ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-semibold">Siparişler yüklenemedi</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Lütfen tekrar deneyin.
          </p>
          <Button className="mt-5 rounded-full" onClick={() => void refetch()}>
            Tekrar dene
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-semibold">Henüz siparişiniz yok</p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/restoranlar">Restoranları keşfet</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              to="/siparis/$id"
              params={{ id: order.id }}
              className="flex items-center gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-card transition-colors hover:border-primary/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{order.restaurants?.name ?? "Restoran"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(order.created_at)} · {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </p>
                {order.status === "cancelled" ? null : (
                  <div className="mt-3 flex gap-1.5" aria-hidden>
                    {ORDER_TRACK_STEPS.map((step, index) => (
                      <span
                        key={step.label}
                        className={`h-1.5 flex-1 rounded-full ${
                          index <= orderStepIndex(order.status) ? "bg-primary" : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <p className="font-semibold">{formatPrice(Number(order.total))}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}