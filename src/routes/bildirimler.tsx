import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck } from "lucide-react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { getMyOrder } from "@/lib/orders.functions";
import { formatDateTime, formatPrice, ORDER_STATUS_LABELS } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bildirimler")({
  head: () => ({
    meta: [{ title: "Bildirimler — SİLVAN CEBİMDE" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAuth>
      <NotificationsPage />
    </RequireAuth>
  ),
});

function NotificationsPage() {
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="size-6 text-primary" />
          <h1 className="font-display text-2xl font-semibold">Bildirimler</h1>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {unreadCount}
            </span>
          ) : null}
        </div>
        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
            <CheckCheck className="mr-1 size-4" />
            Tümünü okundu işaretle
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Henüz bildiriminiz yok.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <NotificationCard key={item.id} item={item} onMarkRead={() => void markRead(item.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  order_id: string | null;
  route: string | null;
  read_at: string | null;
  created_at: string;
};

function NotificationCard({
  item,
  onMarkRead,
}: {
  item: NotificationItem;
  onMarkRead: () => void;
}) {
  const fetchOrder = useServerFn(getMyOrder);
  const orderQuery = useQuery({
    queryKey: ["notification-order", item.order_id],
    queryFn: () => fetchOrder({ data: { id: item.order_id! } }),
    enabled: Boolean(item.order_id),
  });
  const order = orderQuery.data;

  return (
    <li
      className={`rounded-2xl border p-4 ${item.read_at ? "border-border/60 bg-card" : "border-primary/30 bg-primary/5"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {item.title}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {item.read_at ? "Okundu" : "Okunmadı"}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          {order ? (
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>
                Sipariş #{order.id.slice(0, 8)}
                {" · "}
                {formatDateTime(order.created_at)}
                {" · "}
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </p>
              {(order.order_items ?? []).length > 0 ? (
                <p>
                  {(order.order_items ?? [])
                    .map((line) => `${line.quantity}x ${line.name}`)
                    .join(", ")}
                </p>
              ) : null}
              <p className="font-medium text-foreground">
                Toplam: {formatPrice(Number(order.total))}
              </p>
              {order.street ? (
                <p>{[order.street, order.district, order.city].filter(Boolean).join(", ")}</p>
              ) : null}
              {order.note ? <p>Not: {order.note}</p> : null}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</p>
        </div>
        {!item.read_at ? (
          <Button variant="ghost" size="sm" onClick={onMarkRead}>
            Okundu
          </Button>
        ) : null}
      </div>
      {item.route ? (
        <a
          href={item.route}
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          onClick={() => {
            if (!item.read_at) onMarkRead();
          }}
        >
          Detaya git →
        </a>
      ) : null}
    </li>
  );
}
