import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Send, Lock, Megaphone } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { listAdminMessages, sendAdminMessage } from "@/lib/founder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

type TargetType = "all" | "customers" | "vendors" | "restaurant";

const TARGET_LABELS: Record<TargetType, string> = {
  all: "Herkes (müşteriler + işletmeler)",
  customers: "Tüm müşteriler",
  vendors: "Tüm işletmeler",
  restaurant: "Belirli bir işletme",
};

export function NotificationsPanel({ businesses }: { businesses: { id: string; name: string }[] }) {
  const { isFounder } = useSiteSettings();
  const queryClient = useQueryClient();
  const send = useServerFn(sendAdminMessage);
  const fetchMessages = useServerFn(listAdminMessages);

  const [targetType, setTargetType] = useState<TargetType>("all");
  const [restaurantId, setRestaurantId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const messages = useQuery({
    queryKey: ["admin-messages"],
    enabled: isFounder,
    queryFn: () => fetchMessages(),
  });

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          target_type: targetType,
          restaurant_id: targetType === "restaurant" ? restaurantId || null : null,
          title: title.trim(),
          body: body.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Mesaj gönderildi");
      setTitle("");
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  if (!isFounder) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Lock className="size-5 text-muted-foreground" /> Yetkiniz yok
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Duyuru/mesaj göndermeyi yalnızca sayfa yöneticisi rolüne sahip hesaplar kullanabilir.
        </p>
      </div>
    );
  }

  const canSend =
    title.trim().length >= 2 &&
    body.trim().length >= 2 &&
    (targetType !== "restaurant" || Boolean(restaurantId));

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Megaphone className="size-5 text-primary" /> Bildirim gönder
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Müşterilere, işletmelere, herkese veya tek bir işletmeye uygulama içi bildirim gönderin.
          Alıcı uygulamayı açtığında bildirimi görür.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold">Kime gönderilsin</span>
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as TargetType)}
              className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="all">{TARGET_LABELS.all}</option>
              <option value="customers">{TARGET_LABELS.customers}</option>
              <option value="vendors">{TARGET_LABELS.vendors}</option>
              <option value="restaurant">{TARGET_LABELS.restaurant}</option>
            </select>
          </label>

          {targetType === "restaurant" ? (
            <label className="block">
              <span className="text-sm font-semibold">İşletme</span>
              <select
                value={restaurantId}
                onChange={(event) => setRestaurantId(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">İşletme seçin</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="text-sm font-semibold">Başlık</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              className="mt-1.5 rounded-xl"
              placeholder="Örn: Bakım duyurusu"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Mesaj</span>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1000}
              rows={4}
              className="mt-1.5 rounded-xl"
              placeholder="Mesajınızı yazın…"
            />
          </label>
        </div>

        <div className="mt-5">
          <Button
            className="rounded-full"
            disabled={!canSend || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Send className="size-4" />
            {mutation.isPending ? "Gönderiliyor…" : "Gönder"}
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="text-lg">Gönderilen mesajlar</h2>
        {messages.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Yükleniyor…</p>
        ) : !messages.data || messages.data.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Henüz mesaj gönderilmedi.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {messages.data.map((message) => (
              <li
                key={message.id}
                className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{message.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(message.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{message.body}</p>
                <span className="mt-2 inline-block rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {message.target_type === "restaurant"
                    ? (message.restaurants?.name ?? "Belirli bir işletme")
                    : TARGET_LABELS[message.target_type as TargetType]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
