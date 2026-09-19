import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BellOff, PackageOpen, Users } from "lucide-react";
import { getFounderOverview } from "@/lib/founder.functions";
import { formatDateTime } from "@/lib/format";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Uyarı satırı: yalnızca gerçekten bir sorun varken çizilir.
 *
 * Her zaman görünen, çoğu zaman "0" yazan bir uyarı kutusu birkaç gün sonra
 * görünmez oluyor. Sıfırsa hiç çizmiyoruz ki çizildiğinde okunsun.
 */
function Warning({
  icon,
  title,
  names,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  names: string[];
  action: string;
}) {
  if (names.length === 0) return null;
  return (
    <div className="flex gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {title} ({names.length})
        </p>
        <p className="mt-1 break-words text-sm text-muted-foreground">{names.join(" · ")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{action}</p>
      </div>
    </div>
  );
}

export function OverviewPanel() {
  const fetchOverview = useServerFn(getFounderOverview);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["founder-overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <section className="mt-8 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <p className="text-sm text-muted-foreground">Özet yükleniyor…</p>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="mt-8 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <p className="text-sm text-muted-foreground">
          Özet yüklenemedi. Panelin geri kalanı çalışmaya devam ediyor.
        </p>
      </section>
    );
  }

  const { users, businesses, orders, queue } = data;

  return (
    <section className="mt-8 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-accent" />
        <h2 className="text-lg font-semibold">Genel durum</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Kayıtlı kullanıcı"
          value={String(users.total)}
          hint={`son 7 günde +${users.recent}`}
        />
        <Stat
          label="Bildirim alan cihaz"
          value={String(users.devices)}
          hint={`${users.total} kullanıcıdan`}
        />
        <Stat label="Aktif işletme" value={String(businesses.active)} />
        <Stat
          label="Açık sipariş"
          value={String(orders.open)}
          hint={`son 7 günde ${orders.recent} sipariş`}
        />
        <Stat
          label="Toplam sipariş"
          value={String(orders.total)}
          hint={orders.lastAt ? `son: ${formatDateTime(orders.lastAt)}` : "henüz sipariş yok"}
        />
      </div>

      <div className="mt-4 space-y-3">
        <Warning
          icon={<PackageOpen className="size-4" />}
          title="Vitrini boş işletme"
          names={businesses.emptyCatalog}
          action="Müşteri bu işletmelere girdiğinde boş sayfa görüyor. Ürün ekleyin."
        />
        <Warning
          icon={<BellOff className="size-4" />}
          title="Bildirim alamayan işletme"
          names={businesses.withoutPush}
          action="Hiçbir cihazı kayıtlı değil; buraya düşen sipariş kimseye ulaşmaz. İşletme uygulamayı açıp giriş yapmalı."
        />
        {queue.applications > 0 || queue.deletions > 0 ? (
          <div className="flex gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Bekleyen {queue.applications > 0 ? `${queue.applications} işletme başvurusu` : null}
              {queue.applications > 0 && queue.deletions > 0 ? ", " : null}
              {queue.deletions > 0 ? `${queue.deletions} hesap silme talebi` : null} var.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
