import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, RefreshCw, X } from "lucide-react";
import {
  listBusinessApplications,
  reviewBusinessApplication,
} from "@/lib/business-applications.functions";
import { toPublicErrorMessage } from "@/lib/public-error";
import { formatDateTime, formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

const FILTERS = ["pending", "all"] as const;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm">{value || "—"}</p>
    </div>
  );
}

export function ApplicationsPanel({ onApproved }: { onApproved?: () => void }) {
  const fetchApplications = useServerFn(listBusinessApplications);
  const review = useServerFn(reviewBusinessApplication);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const applications = useQuery({
    queryKey: ["business-applications"],
    queryFn: () => fetchApplications(),
  });

  const rows = useMemo(() => {
    const list = applications.data ?? [];
    if (filter === "pending") return list.filter((row) => row.status === "pending");
    return list;
  }, [applications.data, filter]);

  const reviewMutation = useMutation({
    mutationFn: (input: { id: string; action: "approve" | "reject"; note: string }) =>
      review({ data: { id: input.id, action: input.action, note: input.note || null } }),
    onSuccess: (
      result: { approved?: boolean; verificationSent?: boolean },
      variables: { action: "approve" | "reject" },
    ) => {
      toast.success(
        variables.action === "reject"
          ? "Başvuru reddedildi"
          : result?.verificationSent
            ? "Başvuru onaylandı, işletme e-postasına doğrulama kodu gönderildi"
            : "Başvuru onaylandı ve işletme oluşturuldu",
      );
      void queryClient.invalidateQueries({ queryKey: ["business-applications"] });
      onApproved?.();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error, "İşlem yapılamadı.")),
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              filter === value ? "border-transparent bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {value === "pending" ? "Bekleyenler" : "Tümü"}
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => void applications.refetch()}
        >
          <RefreshCw className="size-4" /> Yenile
        </Button>
      </div>

      {applications.isLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Gösterilecek başvuru yok.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <article key={row.id} className="space-y-4 rounded-3xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    /{row.slug} · {formatDateTime(row.created_at)}
                  </p>
                </div>
                <span className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
                  {STATUS_LABELS[row.status] ?? row.status}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Kısa tanıtım" value={row.tagline ?? ""} />
                <Field label="Kategori" value={row.sector} />
                <Field label="Alt tür" value={row.category} />
                <Field label="Etiketler" value={(row.cuisines ?? []).join(", ")} />
                <Field label="Teslimat süresi" value={`${row.delivery_minutes} dk`} />
                <Field label="Teslimat ücreti" value={formatPrice(Number(row.delivery_fee))} />
                <Field label="Min. sepet" value={formatPrice(Number(row.min_order))} />
                <Field label="Görsel adresi" value={row.cover_image_url ?? ""} />
                <Field label="Açık adres" value={row.address ?? ""} />
                <Field label="İlçe" value={row.district ?? ""} />
                <Field label="Şehir" value={row.city ?? ""} />
                <Field
                  label="Koordinat"
                  value={`${row.latitude ?? "—"}, ${row.longitude ?? "—"}`}
                />
                <Field label="Harita bağlantısı" value={row.maps_url ?? ""} />
                <Field label="E-posta" value={row.contact_email ?? ""} />
                <Field label="Telefon" value={row.contact_phone ?? ""} />
                <Field label="Yetkili ad soyad" value={row.contact_person ?? ""} />
                <Field label="Çalışma saatleri" value={`${row.opens_at ?? "—"} - ${row.closes_at ?? "—"}`} />
                <Field label="Sipariş alıyor" value={row.is_open_manual ? "Evet" : "Hayır"} />
              </div>

              {row.founder_note ? (
                <p className="text-sm text-muted-foreground">Kurucu notu: {row.founder_note}</p>
              ) : null}

              {row.status === "pending" ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Karar notu (opsiyonel)"
                    value={notes[row.id] ?? ""}
                    onChange={(event) => setNotes({ ...notes, [row.id]: event.target.value })}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="rounded-full"
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        reviewMutation.mutate({
                          id: row.id,
                          action: "approve",
                          note: notes[row.id] ?? "",
                        })
                      }
                    >
                      <Check className="size-4" /> Onayla
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        reviewMutation.mutate({
                          id: row.id,
                          action: "reject",
                          note: notes[row.id] ?? "",
                        })
                      }
                    >
                      <X className="size-4" /> Reddet
                    </Button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
