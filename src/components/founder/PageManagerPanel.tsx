import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, ShieldCheck, Trash2 } from "lucide-react";
import { toPublicErrorMessage } from "@/lib/public-error";
import { useServiceAreas } from "@/hooks/useTaxonomy";
import {
  listPageManagers,
  grantPageManager,
  revokePageManager,
} from "@/lib/page-managers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";

type UserOption = {
  id: string;
  email: string | null;
  full_name?: string | null;
};

/**
 * Sahip (ana hesap) bu panelden istediği kullanıcıya şehir/ilçe bazlı sayfa
 * yöneticiliği verir veya geri alır. Verilen yetki yalnızca o bölgedeki
 * işletme, ürün, sipariş ve başvurularla sınırlıdır; kullanıcı/rol yönetimi ve
 * sahip hesabı bu yetkinin dışındadır.
 */
export function PageManagerPanel({ users }: { users: UserOption[] }) {
  const queryClient = useQueryClient();
  const fetchGrants = useServerFn(listPageManagers);
  const grant = useServerFn(grantPageManager);
  const revoke = useServerFn(revokePageManager);
  const { areas } = useServiceAreas({ includeHidden: true });

  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [areaId, setAreaId] = useState("");

  const grants = useQuery({ queryKey: ["page-managers"], queryFn: () => fetchGrants() });

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    if (!term) return users.slice(0, 30);
    return users
      .filter(
        (user) =>
          (user.email ?? "").toLocaleLowerCase("tr").includes(term) ||
          (user.full_name ?? "").toLocaleLowerCase("tr").includes(term),
      )
      .slice(0, 30);
  }, [users, search]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["page-managers"] });
  }

  const grantMutation = useMutation({
    mutationFn: () => {
      const area = areas.find((row) => row.id === areaId);
      if (!userId) throw new Error("Kullanıcı seçin");
      if (!area) throw new Error("Bölge seçin");
      return grant({ data: { userId, city: area.city, district: area.district } });
    },
    onSuccess: () => {
      toast.success("Bölge yöneticiliği verildi");
      setUserId("");
      setAreaId("");
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Yetki geri alındı");
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const rows = grants.data ?? [];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border/70 bg-card p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-accent" />
          <h2 className="font-display text-lg font-semibold">Bölgesel yetki ver</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Seçtiğiniz kişi yalnızca atadığınız bölgedeki işletme, ürün, sipariş ve başvuruları
          yönetebilir. Kullanıcı yönetimi, tema ayarları ve ana hesap bilgileriniz bu yetkiye
          kapalıdır.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pm-search">Kullanıcı ara</Label>
            <Input
              id="pm-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="E-posta veya ad soyad"
            />
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              aria-label="Yetki verilecek kullanıcı"
            >
              <option value="">Kullanıcı seçin</option>
              {filteredUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name ? `${user.full_name} — ` : ""}
                  {user.email ?? user.id}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pm-area">Bölge</Label>
            <select
              id="pm-area"
              value={areaId}
              onChange={(event) => setAreaId(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">Bölge seçin</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.district}, {area.city}
                </option>
              ))}
            </select>
            {areas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Önce Bölgeler sekmesinden şehir/ilçe tanımlayın.
              </p>
            ) : null}
          </div>
        </div>

        <Button
          className="mt-4 rounded-full"
          disabled={grantMutation.isPending || !userId || !areaId}
          onClick={() => grantMutation.mutate()}
        >
          Yetki ver
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Verilen yetkiler</h2>
        {grants.isLoading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz bölgesel yetki verilmedi.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {row.full_name?.trim() || "İsim belirtilmemiş"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{row.email ?? row.user_id}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 text-accent" /> {row.district}, {row.city} ·{" "}
                    {formatDateTime(row.created_at)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(row.id)}
                >
                  <Trash2 className="size-4" /> Yetkiyi kaldır
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
