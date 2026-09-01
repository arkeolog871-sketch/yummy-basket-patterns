import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, ScrollText } from "lucide-react";
import { listAuditLogs } from "@/lib/audit.functions";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_LABELS: Record<string, string> = {
  success: "Başarılı",
  error: "Hata",
  denied: "Reddedildi",
};

const ACTION_LABELS: Record<string, string> = {
  "founder.login": "Sayfa yöneticisi girişi",
  "founder.claim": "Sayfa yöneticisi yetkisi alma",
  "founder_contact.update": "Sayfa yöneticisi iletişim bilgisi güncelleme",
  "settings.update": "Tema/ayar güncelleme",
  "business.create": "İşletme ekleme",
  "business.update": "İşletme güncelleme",
  "business.delete": "İşletme silme",
  "menu_category.create": "Menü kategorisi ekleme",
  "menu_category.update": "Menü kategorisi güncelleme",
  "menu_category.delete": "Menü kategorisi silme",
  "menu_item.create": "Ürün ekleme",
  "menu_item.update": "Ürün güncelleme",
  "menu_item.delete": "Ürün silme",
  "role.grant": "Yetki verme",
  "role.revoke": "Yetki kaldırma",
  "user.delete": "Kullanıcı silme",
};

const STATUS_FILTERS = ["all", "success", "error", "denied"] as const;

function statusClass(status: string) {
  if (status === "success") return "bg-warm text-warm-foreground";
  if (status === "denied") return "bg-accent/15 text-accent";
  return "bg-destructive/15 text-destructive";
}

export function AuditLogPanel() {
  const fetchLogs = useServerFn(listAuditLogs);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

  const logs = useQuery({
    queryKey: ["audit-logs", status],
    queryFn: () => fetchLogs({ data: { limit: 200, status } }),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    const list = logs.data ?? [];
    if (!term) return list;
    return list.filter((row) =>
      [row.actor_email ?? "", row.action, row.entity, row.entity_id ?? ""]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(term),
    );
  }, [logs.data, search]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-warm text-warm-foreground">
          <ScrollText className="size-5" />
        </span>
        <div className="mr-auto">
          <h2 className="text-xl">Denetim kaydı</h2>
          <p className="text-sm text-muted-foreground">
            Tüm yönetim işlemleri ve sayfa yöneticisi giriş denemeleri
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => void logs.refetch()}
          disabled={logs.isFetching}
        >
          <RefreshCw className="size-4" /> Yenile
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setStatus(value)}
          >
            {value === "all" ? "Tümü" : STATUS_LABELS[value]}
          </Button>
        ))}
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="E-posta, işlem veya kayıt ara"
          className="h-9 w-full rounded-full sm:max-w-xs"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {logs.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Yükleniyor…</p>
        ) : logs.isError ? (
          <p className="p-6 text-sm text-destructive">Denetim kayıtları alınamadı.</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Kayıt bulunamadı.</p>
        ) : (
          rows.map((row) => {
            const detail = (row.detail ?? {}) as Record<string, unknown>;
            const extras = Object.entries(detail).filter(
              ([key, value]) => key !== "user_agent" && value !== null && value !== "",
            );
            return (
              <div key={row.id} className="border-b border-border/60 p-4 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}
                  >
                    {STATUS_LABELS[row.status] ?? row.status}
                  </span>
                  <p className="font-medium">{ACTION_LABELS[row.action] ?? row.action}</p>
                  <span className="text-xs text-muted-foreground">{row.entity}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.actor_email ?? "Bilinmeyen kullanıcı"}
                  {row.entity_id ? ` · kayıt: ${row.entity_id}` : ""}
                </p>
                {extras.length > 0 && (
                  <p className="mt-1 break-all text-xs text-muted-foreground/80">
                    {extras.map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
