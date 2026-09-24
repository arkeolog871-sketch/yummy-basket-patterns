import {
  LEGAL_CENTER_ORDER,
  LEGAL_DOCUMENTS,
  LEGAL_PACKAGE_LABEL,
  LEGAL_VERSIONS,
} from "@/lib/legal";
import { ComplianceReviewQueue } from "./ComplianceReviewQueue";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getComplianceOverview,
  getPlatformIdentity,
  updatePlatformIdentity,
} from "@/lib/compliance.functions";
import { IDENTITY_LABELS, type PlatformIdentity } from "@/lib/compliance";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Key = keyof PlatformIdentity;
const KEYS = Object.keys(IDENTITY_LABELS) as Key[];

/** Kurucu: Hukuk ve Uyum Merkezi + Platform Kimliği. */
export function CompliancePanel() {
  const fetchOverview = useServerFn(getComplianceOverview);
  const fetchIdentity = useServerFn(getPlatformIdentity);
  const saveIdentity = useServerFn(updatePlatformIdentity);
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ["compliance-overview"], queryFn: () => fetchOverview() });
  const identity = useQuery({ queryKey: ["platform-identity"], queryFn: () => fetchIdentity() });
  const [form, setForm] = useState<Record<Key, string>>(
    () => Object.fromEntries(KEYS.map((k) => [k, ""])) as Record<Key, string>,
  );
  useEffect(() => {
    const id = identity.data?.identity;
    if (id)
      setForm(Object.fromEntries(KEYS.map((k) => [k, String(id[k] ?? "")])) as Record<Key, string>);
  }, [identity.data]);

  const save = useMutation({
    mutationFn: () =>
      saveIdentity({
        data: Object.fromEntries(KEYS.map((k) => [k, form[k].trim() || null])) as never,
      }),
    onSuccess: async () => {
      toast.success("Platform kimliği kaydedildi.");
      await qc.invalidateQueries({ queryKey: ["platform-identity"] });
      await qc.invalidateQueries({ queryKey: ["compliance-overview"] });
    },
    onError: (e) => toast.error(toPublicErrorMessage(e, "Kaydedilemedi.")),
  });

  const o = overview.data;
  const lists: [string, number, string[]][] = o
    ? [
        [
          "Bekleyen satıcı doğrulamaları",
          o.pendingVendors.length,
          o.pendingVendors.map((r) => r.name),
        ],
        [
          "İncelenmeyi bekleyen belgeler",
          o.pendingDocuments.length,
          o.pendingDocuments.map((d) => d.doc_kind),
        ],
        [
          "Süresi dolan belgeler",
          o.expiredDocuments.length,
          o.expiredDocuments.map((d) => `${d.doc_kind} · ${d.expires_at}`),
        ],
        [
          "Güncel sözleşmeyi onaylamayan işletmeler",
          o.outdatedAgreements.length,
          o.outdatedAgreements.map((r) => r.name),
        ],
        [
          "Açık şikâyetler",
          o.openComplaints.length,
          o.openComplaints.map((c) => `${c.subject} · ${c.status}`),
        ],
        [
          "Bekleyen iade talepleri",
          o.openRefunds.length,
          o.openRefunds.map((r) => `${r.status} · ${r.requested_amount ?? "tam"}`),
        ],
        [
          "Raporlanan içerikler",
          o.openReports.length,
          o.openReports.map((r) => `${r.target_type} · ${r.reason}`),
        ],
        [
          "Açık veri ihlali olayları",
          o.openIncidents.length,
          o.openIncidents.map((i) => i.affected_system),
        ],
        [
          "Veri silme talepleri",
          o.pendingDeletions.length,
          o.pendingDeletions.map((d) => d.created_at.slice(0, 10)),
        ],
        [
          "Yurt dışı aktarım dayanağı bekleyen hizmetler",
          o.pendingTransfers.length,
          o.pendingTransfers.map((p) => p.name),
        ],
      ]
    : [];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Platform Kimliği</h2>
        {identity.data?.missing.length ? (
          <p className="mt-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            Eksik kimlik alanları: {identity.data.missing.join(", ")}. Belgeler kullanıcılar
            tarafından okunabilir; yalnız yayına alma bu alanlar tamamlanana kadar kapalıdır.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Zorunlu kimlik alanları tamam.</p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {KEYS.map((k) => (
            <label key={k} className="text-sm">
              <span className="mb-1 block text-muted-foreground">{IDENTITY_LABELS[k]}</span>
              <Input
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="rounded-full" disabled={save.isPending} onClick={() => save.mutate()}>
            Kaydet
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            disabled={publish.isPending || Boolean(identity.data?.missing.length)}
            onClick={() => publish.mutate()}
          >
            {publish.isPending ? "Yayınlanıyor…" : "Yasal metinleri yayına al"}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Hukuk ve Uyum Merkezi</h2>
        {overview.isLoading ? <p className="text-sm text-muted-foreground">Yükleniyor…</p> : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {lists.map(([title, count, items]) => (
            <details key={title} className="rounded-2xl border border-border bg-card p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                {title}: {count}
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {items.slice(0, 30).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Manuel doğrulama bekleyen belgeler</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {LEGAL_PACKAGE_LABEL}. Aşağıdaki metinler nihai yayından önce hukukçu tarafından kontrol
          edilmelidir.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {LEGAL_CENTER_ORDER.filter((id) => LEGAL_DOCUMENTS[id].requiresLegalReview).map((id) => (
            <li key={id} className="flex justify-between gap-2">
              <a href={LEGAL_DOCUMENTS[id].path} className="underline underline-offset-4">
                {LEGAL_DOCUMENTS[id].title}
              </a>
              <span className="text-muted-foreground">
                Sürüm {LEGAL_VERSIONS[id]}.0 · manuel doğrulama
              </span>
            </li>
          ))}
        </ul>
      </section>
      <ComplianceReviewQueue />
    </div>
  );
}
