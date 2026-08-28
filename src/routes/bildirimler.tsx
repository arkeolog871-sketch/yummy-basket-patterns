import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bildirimler")({
  head: () => ({
    meta: [
      { title: "Bildirimler — SİLVAN CEBİMDE" },
      { name: "robots", content: "noindex" },
    ],
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
            <li
              key={item.id}
              className={`rounded-2xl border p-4 ${item.read_at ? "border-border/60 bg-card" : "border-primary/30 bg-primary/5"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDateTime(item.created_at)}
                  </p>
                </div>
                {!item.read_at ? (
                  <Button variant="ghost" size="sm" onClick={() => void markRead(item.id)}>
                    Okundu
                  </Button>
                ) : null}
              </div>
              {item.route ? (
                <a
                  href={item.route}
                  className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                  onClick={() => {
                    if (!item.read_at) void markRead(item.id);
                  }}
                >
                  Detaya git →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
