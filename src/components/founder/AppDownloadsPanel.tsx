import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { getAppDownloadsOverview } from "@/lib/app-downloads.functions";

/** `getAppDownloadsOverview`'in döndürdüğü "ok:false" sebeplerinin kullanıcıya görünen açıklaması. */
const REASON_LABELS: Record<string, string> = {
  unconfigured: "Yapılandırılmamış",
  no_report_file: "Veri henüz hazır değil",
  pending: "Veri henüz hazır değil",
  request_created: "İlk istek gönderildi, veri 1-2 gün içinde gelecek",
  error: "Veri şu an alınamadı",
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? "Veri şu an alınamadı";
}

/**
 * Google Play ve App Store'un gerçek kurulum/indirme sayıları. İkisi de ayrı
 * sistemler (Play Console'un bulut deposu / Apple Analytics Reports); biri
 * henüz veri vermese de diğeri gösterilsin diye bağımsız kartlar.
 */
export function AppDownloadsPanel() {
  const fetchOverview = useServerFn(getAppDownloadsOverview);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["app-downloads-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 5 * 60_000,
  });

  return (
    <section className="mt-8 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
      <span className="flex items-center gap-2">
        <Download className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">Uygulama indirmeleri</h2>
      </span>

      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : isError || !data ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Yüklenemedi. Panelin geri kalanı çalışmaya devam ediyor.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/60 bg-background/60 p-3">
            <p className="text-[11px] text-muted-foreground">Android (Google Play)</p>
            {data.android.ok ? (
              <>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {data.android.totalInstalls ?? data.android.periodInstalls ?? "—"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {data.android.lastDate ? `son veri: ${data.android.lastDate}` : "toplam kurulum"}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reasonLabel(data.android.reason)}
                </p>
                {data.android.detail ? (
                  <p className="mt-1 text-[10px] break-words text-muted-foreground/70">
                    {data.android.detail}
                  </p>
                ) : null}
              </>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-3">
            <p className="text-[11px] text-muted-foreground">iOS (App Store)</p>
            {data.ios.ok ? (
              <>
                <p className="mt-1 text-xl font-semibold tabular-nums">{data.ios.totalDownloads}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {data.ios.date ? `son veri: ${data.ios.date}` : "güncel gün"}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">{reasonLabel(data.ios.reason)}</p>
                {data.ios.detail ? (
                  <p className="mt-1 text-[10px] break-words text-muted-foreground/70">
                    {data.ios.detail}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
