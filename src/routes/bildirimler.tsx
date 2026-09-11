import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import {
  listMyNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/notifications.functions";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PushNotificationButton } from "@/components/notifications/PushNotificationButton";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bildirimler")({
  head: () => ({
    meta: [
      { title: "Bildirimler — SİLVAN CEBİMDE" },
      {
        name: "description",
        content: "Duyuru ve sipariş bildirimlerinizi SİLVAN CEBİMDE üzerinden takip edin.",
      },
      { property: "og:title", content: "Bildirimler — SİLVAN CEBİMDE" },
      { property: "og:description", content: "Duyuru ve sipariş bildirimlerinizi görüntüleyin." },
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
  const fetchNotifications = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationsRead);
  const queryClient = useQueryClient();

  const {
    data: notifications = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    refetchInterval: 30000,
  });

  const unreadIds = notifications.filter((item) => !item.read_at).map((item) => item.id);

  // Sayfa açıldığında (veya yeni okunmamış bildirim geldiğinde) okundu işaretle.
  useEffect(() => {
    if (unreadIds.length === 0) return;
    void markRead({ data: { ids: unreadIds } }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds.join(",")]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl">
          <Bell className="size-7 text-accent" /> Bildirimler
        </h1>
        <PushNotificationButton />
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : isError ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-semibold">Bildirimler yüklenemedi</p>
          <Button className="mt-5 rounded-full" onClick={() => void refetch()}>
            Tekrar dene
          </Button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-semibold">Henüz bildiriminiz yok</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Duyurular ve sipariş durum bildirimleri burada görünür.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/restoranlar">Restoranları keşfet</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {notifications.map((item) => (
            <NotificationCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationCard({ item }: { item: NotificationItem }) {
  const unread = !item.read_at;
  const content = (
    <>
      <span
        className={`mt-1 size-2.5 shrink-0 rounded-full ${unread ? "bg-accent" : "bg-border"}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate ${unread ? "font-bold" : "font-medium"}`}>{item.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</p>
      </div>
    </>
  );

  const className = `flex items-start gap-4 rounded-3xl border bg-card p-4 shadow-card transition-colors ${
    unread ? "border-accent/40" : "border-border/70"
  }`;

  if (item.url) {
    return (
      <Link to={item.url} className={`${className} hover:border-primary/40`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
