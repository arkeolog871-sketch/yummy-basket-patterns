import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { listMyOrders } from "@/lib/orders.functions";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { formatPrice, formatDateTime, ORDER_STATUS_LABELS } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bildirimler")({
  head: () => ({
    meta: [
      { title: "Bildirimler — SİLVAN CEBİMDE" },
      { name: "description", content: "Sipariş durumu bildirimlerinizi SİLVAN CEBİMDE üzerinden takip edin." },
      { property: "og:title", content: "Bildirimler — SİLVAN CEBİMDE" },
      { property: "og:description", content: "Sipariş durumu bildirimlerinizi görüntüleyin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth requireVerified>
      <NotificationsPage />
    </RequireAuth>
  ),
});

function NotificationsPage() {
  const fetchOrders = useServerFn(listMyOrders);
  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchOrders(),
    refetchInterval: 15000,
  });

  const active = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-3xl">
        <Bell className="size-7 text-accent" /> Bildirimler
      </h1>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : isError ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-semibold">Bildirimler yüklenemedi</p>
          <Button className="mt-5 rounded-full" onClick={() => void refetch()}>
            Tekrar dene
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-semibold">Henüz bildiriminiz yok</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Sipariş verdiğinizde durum bildirimleri burada görünür.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/restoranlar">Restoranları keşfet</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {active.length > 0 ? (
            <p className="text-sm font-medium text-muted-foreground">
              {active.length} aktif sipariş bildirimi
            </p>
          ) : null}
          {orders.map((order) => (
            <Link
              key={order.id}
              to="/siparis/$id"
              params={{ id: order.id }}
              className="flex items-start gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-card transition-colors hover:border-primary/40"
            >
              <span
                className={`mt-1 size-2.5 shrink-0 rounded-full ${
                  order.status === "delivered" || order.status === "cancelled"
                    ? "bg-border"
                    : "bg-accent"
                }`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {order.restaurants?.name ?? "Restoran"} —{" "}
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(order.created_at)}
                </p>
              </div>
              <p className="font-semibold">{formatPrice(Number(order.total))}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
