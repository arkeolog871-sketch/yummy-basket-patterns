import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { founderSendNotification } from "@/lib/notifications.functions";
import { listAdminData, listUsers } from "@/lib/founder.functions";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Target = "all" | "all_vendors" | "all_customers" | "restaurant" | "user";

export function NotificationsPanel() {
  const send = useServerFn(founderSendNotification);
  const fetchAdmin = useServerFn(listAdminData);
  const fetchUsers = useServerFn(listUsers);

  const admin = useQuery({ queryKey: ["admin-data"], queryFn: () => fetchAdmin() });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });

  const [target, setTarget] = useState<Target>("all");
  const [restaurantId, setRestaurantId] = useState("");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          target,
          restaurantId: target === "restaurant" ? restaurantId || null : null,
          userId: target === "user" ? userId || null : null,
          title,
          body,
        },
      }),
    onSuccess: (result) => {
      toast.success(`Bildirim gönderildi (${result.sent} alıcı)`);
      setTitle("");
      setBody("");
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const restaurants = admin.data?.businesses ?? [];
  const userRows = users.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Bildirim Gönder</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mesaj hem bildirim merkezine kaydedilir hem de kayıtlı cihazlara push olarak iletilir.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Hedef</Label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Herkes"],
              ["all_vendors", "Tüm İşletmeler"],
              ["all_customers", "Tüm Kullanıcılar"],
              ["restaurant", "Seçili İşletme"],
              ["user", "Seçili Kullanıcı"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={target === value ? "default" : "outline"}
              onClick={() => setTarget(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {target === "restaurant" ? (
        <div className="space-y-2">
          <Label htmlFor="notify-restaurant">İşletme</Label>
          <select
            id="notify-restaurant"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            value={restaurantId}
            onChange={(event) => setRestaurantId(event.target.value)}
          >
            <option value="">İşletme seçin</option>
            {restaurants.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {target === "user" ? (
        <div className="space-y-2">
          <Label htmlFor="notify-user">Kullanıcı</Label>
          <select
            id="notify-user"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          >
            <option value="">Kullanıcı seçin</option>
            {userRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.email}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="notify-title">Başlık</Label>
        <Input
          id="notify-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          placeholder="Bildirim başlığı"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notify-body">Mesaj</Label>
        <Textarea
          id="notify-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Bildirim içeriği"
        />
      </div>

      <Button
        type="button"
        disabled={
          mutation.isPending ||
          !title.trim() ||
          !body.trim() ||
          (target === "restaurant" && !restaurantId) ||
          (target === "user" && !userId)
        }
        onClick={() => mutation.mutate()}
      >
        <Send className="mr-2 size-4" />
        Gönder
      </Button>
    </div>
  );
}
