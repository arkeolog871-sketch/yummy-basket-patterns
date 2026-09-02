import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, UserX } from "lucide-react";
import { listDeletionRequests, reviewDeletionRequest } from "@/lib/founder.functions";
import { toPublicErrorMessage } from "@/lib/public-error";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

function statusClass(status: string) {
  if (status === "rejected") return "bg-destructive/15 text-destructive";
  if (status === "approved") return "bg-warm text-warm-foreground";
  return "bg-accent/15 text-accent";
}

const FILTERS = ["pending", "all"] as const;

export function DeletionRequestsPanel() {
  const fetchRequests = useServerFn(listDeletionRequests);
  const review = useServerFn(reviewDeletionRequest);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const requests = useQuery({
    queryKey: ["deletion-requests"],
    queryFn: () => fetchRequests(),
  });

  const rows = useMemo(() => {
    const list = requests.data ?? [];
    if (filter === "pending") return list.filter((row) => row.status === "pending");
    return list;
  }, [requests.data, filter]);

  const reviewMutation = useMutation({
    mutationFn: (input: { requestId: string; action: "approve" | "reject"; note: string }) =>
      review({
        data: { requestId: input.requestId, action: input.action, note: input.note || null },
      }),
    onSuccess: (_result, variables) => {
      toast.success(
        variables.action === "approve" ? "Hesap ve verileri silindi" : "Silme talebi reddedildi",
      );
      void queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error, "İşlem yapılamadı.")),
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-warm text-warm-foreground">
          <UserX className="size-5" />
        </span>
        <div className="mr-auto">
          <h2 className="text-xl">Hesap silme talepleri</h2>
          <p className="text-sm text-muted-foreground">
            Müşteri ve işletme hesap/veri silme talepleri — onaylanmadan hiçbir hesap silinmez
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => void requests.refetch()}
          disabled={requests.isFetching}
        >
          <RefreshCw className="size-4" /> Yenile
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={filter === "pending" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setFilter("pending")}
        >
          Bekleyenler
        </Button>
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setFilter("all")}
        >
          Tümü
        </Button>
      </div>

      <div className="space-y-3">
        {requests.isLoading ? (
          <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Yükleniyor…
          </p>
        ) : requests.isError ? (
          <p className="rounded-3xl border border-border bg-card p-6 text-sm text-destructive">
            Talepler alınamadı.
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
            {filter === "pending" ? "Bekleyen talep yok." : "Kayıt bulunamadı."}
          </p>
        ) : (
          rows.map((row) => {
            const pending = row.status === "pending";
            const busy = reviewMutation.isPending && reviewMutation.variables?.requestId === row.id;
            return (
              <div key={row.id} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}
                  >
                    {STATUS_LABELS[row.status] ?? row.status}
                  </span>
                  <p className="font-medium">{row.email ?? "E-posta yok"}</p>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </span>
                </div>
                {row.phone ? (
                  <p className="mt-1 text-xs text-muted-foreground">Telefon: {row.phone}</p>
                ) : null}
                {row.reason ? (
                  <p className="mt-2 text-sm">{row.reason}</p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Gerekçe belirtilmemiş.</p>
                )}
                {row.founder_note ? (
                  <p className="mt-2 text-xs text-muted-foreground">Not: {row.founder_note}</p>
                ) : null}

                {pending ? (
                  <div className="mt-4 space-y-3">
                    <Textarea
                      value={notes[row.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                      placeholder="Karar notu (isteğe bağlı, talep sahibine gösterilmez)"
                      className="rounded-2xl"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        className="rounded-full"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `${row.email ?? "Bu kullanıcının"} hesabı ve tüm verileri kalıcı olarak silinecek. Onaylıyor musunuz?`,
                            )
                          ) {
                            reviewMutation.mutate({
                              requestId: row.id,
                              action: "approve",
                              note: notes[row.id] ?? "",
                            });
                          }
                        }}
                      >
                        Onayla ve hesabı sil
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-full"
                        disabled={busy}
                        onClick={() =>
                          reviewMutation.mutate({
                            requestId: row.id,
                            action: "reject",
                            note: notes[row.id] ?? "",
                          })
                        }
                      >
                        Reddet
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
