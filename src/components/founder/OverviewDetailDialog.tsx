import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getOverviewDetail } from "@/lib/founder-overview-detail.functions";

export type OverviewMetric = "users" | "devices" | "businesses" | "openOrders" | "orders";

/**
 * Genel durum kartına tıklandığında sayının arkasındaki satırları gösterir.
 *
 * Veri yalnızca pencere açıldığında çekiliyor: beş ölçütün hepsini kart
 * çizilirken yüklemek, paneli her açılışta gereksiz yere yavaşlatırdı.
 */
export function OverviewDetailDialog({
  metric,
  onClose,
}: {
  metric: OverviewMetric | null;
  onClose: () => void;
}) {
  const fetchDetail = useServerFn(getOverviewDetail);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["founder-overview-detail", metric],
    queryFn: () => fetchDetail({ data: { metric: metric! } }),
    enabled: Boolean(metric),
  });

  return (
    <Dialog open={Boolean(metric)} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>{data?.title ?? "Ayrıntı"}</DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Yükleniyor…"
              : isError
                ? "Ayrıntı yüklenemedi."
                : (data?.note ?? `${data?.rows.length ?? 0} kayıt`)}
          </DialogDescription>
        </DialogHeader>

        {data && data.rows.length > 0 ? (
          <ul className="-mx-1 max-h-[60vh] space-y-1 overflow-y-auto px-1">
            {data.rows.map((row) => (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium [overflow-wrap:anywhere]">{row.primary}</p>
                  {row.secondary ? (
                    <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {row.secondary}
                    </p>
                  ) : null}
                </div>
                {row.meta ? (
                  <span
                    className={`shrink-0 text-right text-xs ${
                      row.tone === "ok"
                        ? "text-success"
                        : row.tone === "warn"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {row.meta}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : data && !isLoading ? (
          <p className="text-sm text-muted-foreground">Gösterilecek kayıt yok.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
