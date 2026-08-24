import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Check, Trash2, RotateCcw } from "lucide-react";

import { useAccess } from "@/hooks/useAccess";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { listAppErrors, resolveAppError, deleteAppError } from "@/lib/errors.functions";
import { toPublicErrorMessage } from "@/lib/public-error";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/sistem-hatalari")({
  head: () => ({
    meta: [
      { title: "Sistem Hataları — SİLVAN CEBİMDE" },
      {
        name: "description",
        content:
          "Kurucu paneli sistem hata kayıtları: uygulamada oluşan çalışma zamanı hatalarını görüntüleyin, çözüldü olarak işaretleyin veya silin.",
      },
      { property: "og:title", content: "Sistem Hataları — SİLVAN CEBİMDE" },
      {
        property: "og:description",
        content: "Uygulamada oluşan sistem hatalarının kurucu görünümü.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SystemErrorsPage,
});

const STATUS_FILTERS = [
  { key: "open", label: "Açık" },
  { key: "resolved", label: "Çözüldü" },
  { key: "all", label: "Tümü" },
] as const;

function SystemErrorsPage() {
  const { loading, isFounder } = useAccess();
  const queryClient = useQueryClient();
  const fetchErrors = useServerFn(listAppErrors);
  const resolve = useServerFn(resolveAppError);
  const remove = useServerFn(deleteAppError);

  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]["key"]>("open");
  const [search, setSearch] = useState("");

  const errors = useQuery({
    queryKey: ["app-errors", status],
    enabled: isFounder,
    queryFn: () => fetchErrors({ data: { limit: 200, status } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["app-errors"] });

  const toggleResolved = useMutation({
    mutationFn: (input: { id: string; resolved: boolean }) => resolve({ data: input }),
    onSuccess: () => {
      toast.success("Kayıt güncellendi");
      void invalidate();
    },
    onError: (error) => toast.error(toPublicErrorMessage(error)),
  });

  const deleteRow = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Kayıt silindi");
      void invalidate();
    },
    onError: (error) => toast.error(toPublicErrorMessage(error)),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    const list = errors.data ?? [];
    if (!term) return list;
    return list.filter((row) =>
      [row.message, row.path ?? "", row.source]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(term),
    );
  }, [errors.data, search]);

  if (loading) {
    return <div className="px-4 py-24 text-center text-sm text-muted-foreground">Yükleniyor…</div>;
  }

  if (!isFounder) {
    return <AccessDenied message="Sistem hata kayıtlarını yalnızca kurucu görebilir." />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </span>
        <div className="mr-auto">
          <h1 className="text-2xl">Sistem hataları</h1>
          <p className="text-sm text-muted-foreground">
            Uygulamada oluşan çalışma zamanı hataları, sayfa adresi ve tekrar sayısıyla
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => void errors.refetch()}
        >
          <RefreshCw className="mr-2 size-4" />
          Yenile
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.key}
            size="sm"
            variant={status === filter.key ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setStatus(filter.key)}
          >
            {filter.label}
          </Button>
        ))}
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Hata mesajı veya sayfa ara"
          className="ml-auto w-full max-w-xs rounded-full"
        />
      </div>

      <div className="mt-6 space-y-3">
        {errors.isLoading ? (
          <p className="text-sm text-muted-foreground">Kayıtlar yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Kayıt bulunmuyor. Sistem şu anda hata bildirmiyor.
          </p>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start gap-2">
                <p className="mr-auto text-sm font-medium text-foreground">{row.message}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {row.source === "server" ? "sunucu" : "istemci"}
                </span>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                  {row.occurrences}× tekrar
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {row.path ? `Sayfa: ${row.path} · ` : null}
                Son görülme: {formatDateTime(row.last_seen_at)}
              </p>
              {row.stack ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Teknik detay
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-[11px] text-muted-foreground">
                    {row.stack}
                  </pre>
                </details>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={toggleResolved.isPending}
                  onClick={() =>
                    toggleResolved.mutate({ id: row.id, resolved: !row.resolved })
                  }
                >
                  {row.resolved ? (
                    <>
                      <RotateCcw className="mr-2 size-4" />
                      Yeniden aç
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 size-4" />
                      Çözüldü işaretle
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-destructive"
                  disabled={deleteRow.isPending}
                  onClick={() => deleteRow.mutate(row.id)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Sil
                </Button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
