import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BellOff, ChevronRight, PackageOpen, Users } from "lucide-react";
import { getFounderOverview } from "@/lib/founder.functions";
import { formatDateTime } from "@/lib/format";
import {
  OverviewDetailDialog,
  type OverviewMetric,
} from "@/components/founder/OverviewDetailDialog";

/**
 * Sayının arkasındaki satırlar tek tıkla açılsın diye kart bir düğme.
 * Rakam tek başına "kime ulaşamıyorum", "kim bekliyor" sorularını
 * cevaplamıyordu; paneli okumaktan eyleme geçirmenin en kısa yolu bu.
 */
function Stat({
  label,
  value,
  hint,
  onOpen,
}: {
  label: string;
  value: string;
  hint?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label} ayrıntısını aç`}
      className="group flex min-w-0 flex-col justify-start rounded-xl border border-border/60 bg-background/60 p-2.5 text-left transition-colors hover:border-accent/60 hover:bg-accent/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-3"
    >
      <p className="flex items-start gap-0.5 text-[11px] leading-tight text-muted-foreground">
        <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        <ChevronRight className="mt-px size-3 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
      </p>
      <p className="mt-1 text-lg font-semibold leading-none tabular-nums sm:text-xl">{value}</p>
      {hint ? (
        <p className="mt-1 text-[10px] leading-tight text-muted-foreground [overflow-wrap:anywhere]">
          {hint}
        </p>
      ) : null}
    </button>
  );
}

type OverviewData = Awaited<ReturnType<typeof getFounderOverview>>;

/**
 * Genel durum kartları. Her ekranda 3 sütun (5 kart → 3 + 2).
 *
 * NEDEN: telefonda 2 sütundu ve kartlar büyük (16px iç boşluk, 24px sayı)
 * olduğu için beş kart ekranın büyük kısmını kaplıyordu; kullanıcı
 * küçültülüp 3 sütun dizilmesini istedi. Ayrı bileşen, örnek veriyle
 * ölçülebilsin diye.
 */
export function OverviewStatGrid({
  users,
  businesses,
  orders,
  onOpen,
}: Pick<OverviewData, "users" | "businesses" | "orders"> & {
  onOpen: (metric: OverviewMetric) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
      <Stat
        label="Kayıtlı kullanıcı"
        value={String(users.total)}
        hint={`son 7 günde +${users.recent}`}
        onOpen={() => onOpen("users")}
      />
      <Stat
        label="Bildirim alan cihaz"
        value={String(users.devices)}
        hint={`${users.total} kullanıcıdan`}
        onOpen={() => onOpen("devices")}
      />
      <Stat
        label="Aktif işletme"
        value={String(businesses.active)}
        onOpen={() => onOpen("businesses")}
      />
      <Stat
        label="Açık sipariş"
        value={String(orders.open)}
        hint={`son 7 günde ${orders.recent} sipariş`}
        onOpen={() => onOpen("openOrders")}
      />
      <Stat
        label="Toplam sipariş"
        value={String(orders.total)}
        hint={orders.lastAt ? `son: ${formatDateTime(orders.lastAt)}` : "henüz sipariş yok"}
        onOpen={() => onOpen("orders")}
      />
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
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
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
  const [detail, setDetail] = useState<OverviewMetric | null>(null);
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
        <Users className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">Genel durum</h2>
      </div>

      <OverviewStatGrid users={users} businesses={businesses} orders={orders} onOpen={setDetail} />

      <OverviewDetailDialog metric={detail} onClose={() => setDetail(null)} />

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
          action="Buraya düşen sipariş kimseye ulaşmaz. İşletmeler sekmesindeki Bildirim bağlantısı bölümünden durumu görüp bağlama kodu üretin — sahip Apple/Google ile girdiyse hesabı işletmeye kodla bağlanır."
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
