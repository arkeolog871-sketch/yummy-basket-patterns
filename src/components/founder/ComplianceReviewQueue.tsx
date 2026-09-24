import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BUSINESS_DOC_KINDS,
  createSecurityIncident,
  decideBusinessDocument,
  decideComplaint,
  decideContentReport,
  decideRefund,
  getBusinessDocumentUrl,
  getReviewQueue,
  updateSecurityIncident,
  type BusinessDocKind,
} from "@/lib/compliance-review.functions";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const REPORT_REASON: Record<string, string> = {
  insult: "Hakaret",
  personal_data: "Kişisel veri",
  threat: "Tehdit",
  misleading: "Yanıltıcı",
  illegal: "Hukuka aykırı",
  spam: "Spam",
  other: "Diğer",
};

function restaurantName(r: unknown): string {
  return (r as { name?: string } | null)?.name ?? "—";
}

/**
 * Kurucu karar ekranı. Her karar gerekçe ister; gerekçe ve karar denetim
 * kaydına yazılır. Kritik kararlar (red, içerik kaldırma, iade reddi)
 * ikinci bir onay penceresiyle teyit edilir.
 */
export function ComplianceReviewQueue() {
  const qc = useQueryClient();
  const fetchQueue = useServerFn(getReviewQueue);
  const docFn = useServerFn(decideBusinessDocument);
  const complaintFn = useServerFn(decideComplaint);
  const refundFn = useServerFn(decideRefund);
  const reportFn = useServerFn(decideContentReport);
  const urlFn = useServerFn(getBusinessDocumentUrl);
  const incidentFn = useServerFn(createSecurityIncident);
  const incidentUpdateFn = useServerFn(updateSecurityIncident);
  const { data } = useQuery({ queryKey: ["compliance-queue"], queryFn: () => fetchQueue() });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [inc, setInc] = useState({ system: "", categories: "", count: "", measures: "" });

  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      toast.success("Karar kaydedildi.");
      await qc.invalidateQueries({ queryKey: ["compliance-queue"] });
      await qc.invalidateQueries({ queryKey: ["compliance-overview"] });
    },
    onError: (e) => toast.error(toPublicErrorMessage(e)),
  });
  const note = (id: string) => notes[id]?.trim() ?? "";
  const critical = (label: string, fn: () => Promise<unknown>) => {
    if (window.confirm(`${label} Bu karar kayda geçer. Emin misiniz?`)) run.mutate(fn);
  };
  const noteInput = (id: string) => (
    <Input
      className="mt-2"
      placeholder="Gerekçe (zorunlu)"
      maxLength={1000}
      value={notes[id] ?? ""}
      onChange={(e) => setNotes((n) => ({ ...n, [id]: e.target.value }))}
    />
  );

  if (!data) return null;
  const box = "rounded-3xl border border-border/70 bg-card p-4 shadow-card";
  const item = "rounded-2xl border border-border/60 p-3 text-sm";
  return (
    <div className="space-y-4">
      <section className={box}>
        <h3 className="font-semibold">Belge incelemesi ({data.documents.length})</h3>
        <ul className="mt-3 space-y-2">
          {data.documents.map((d) => (
            <li key={d.id} className={item}>
              <p className="font-semibold">
                {restaurantName(d.restaurants)} ·{" "}
                {BUSINESS_DOC_KINDS[d.doc_kind as BusinessDocKind] ?? d.doc_kind}
              </p>
              <p className="text-xs text-muted-foreground">
                No: {d.document_no ?? "—"} · Geçerlilik: {d.expires_at ?? "belirtilmedi"}
              </p>
              {noteInput(d.id)}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const { url } = await urlFn({ data: { id: d.id } });
                      window.open(url, "_blank", "noopener");
                    } catch (e) {
                      toast.error(toPublicErrorMessage(e));
                    }
                  }}
                >
                  Belgeyi aç
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    run.mutate(() =>
                      docFn({ data: { id: d.id, decision: "approved", note: note(d.id) || null } }),
                    )
                  }
                >
                  Onayla
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!note(d.id)}
                  onClick={() =>
                    critical("Belge reddedilecek.", () =>
                      docFn({ data: { id: d.id, decision: "rejected", note: note(d.id) } }),
                    )
                  }
                >
                  Reddet
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={box}>
        <h3 className="font-semibold">Şikâyetler ({data.complaints.length})</h3>
        <ul className="mt-3 space-y-2">
          {data.complaints.map((c) => (
            <li key={c.id} className={item}>
              <p className="font-semibold">
                {c.subject} · {restaurantName(c.restaurants)} · {c.status}
              </p>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">{c.body}</p>
              {noteInput(c.id)}
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["SELLER_RESPONSE", "Satıcıya yönlendir"],
                    ["PLATFORM_REVIEW", "Platform incelemesi"],
                    ["RESOLVED", "Çözüldü"],
                  ] as const
                ).map(([s, label]) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    disabled={note(c.id).length < 3}
                    onClick={() =>
                      run.mutate(() =>
                        complaintFn({ data: { id: c.id, status: s, message: note(c.id) } }),
                      )
                    }
                  >
                    {label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={note(c.id).length < 3}
                  onClick={() =>
                    critical("Şikâyet reddedilecek.", () =>
                      complaintFn({ data: { id: c.id, status: "REJECTED", message: note(c.id) } }),
                    )
                  }
                >
                  Reddet
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={box}>
        <h3 className="font-semibold">İade talepleri ({data.refunds.length})</h3>
        <ul className="mt-3 space-y-2">
          {data.refunds.map((r) => (
            <li key={r.id} className={item}>
              <p className="font-semibold">
                {restaurantName(r.restaurants)} · {r.status}
                {r.requested_amount ? ` · ${r.requested_amount} TL` : ""}
              </p>
              <p className="mt-1 text-muted-foreground">{r.reason}</p>
              {noteInput(r.id)}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={note(r.id).length < 3}
                  onClick={() =>
                    run.mutate(() =>
                      refundFn({ data: { id: r.id, status: "seller_review", note: note(r.id) } }),
                    )
                  }
                >
                  Satıcıya sor
                </Button>
                <Button
                  size="sm"
                  disabled={note(r.id).length < 3}
                  onClick={() =>
                    run.mutate(() =>
                      refundFn({ data: { id: r.id, status: "approved", note: note(r.id) } }),
                    )
                  }
                >
                  İadeyi onayla
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={note(r.id).length < 3}
                  onClick={() =>
                    critical("İade talebi reddedilecek.", () =>
                      refundFn({ data: { id: r.id, status: "rejected", note: note(r.id) } }),
                    )
                  }
                >
                  Reddet
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={box}>
        <h3 className="font-semibold">İçerik raporları ({data.reports.length})</h3>
        <ul className="mt-3 space-y-2">
          {data.reports.map((r) => (
            <li key={r.id} className={item}>
              <p className="font-semibold">
                {r.target_type} · {REPORT_REASON[r.reason] ?? r.reason}
              </p>
              {r.details ? <p className="mt-1 text-muted-foreground">{r.details}</p> : null}
              {noteInput(r.id)}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={note(r.id).length < 3}
                  onClick={() =>
                    run.mutate(() =>
                      reportFn({ data: { id: r.id, decision: "dismissed", reason: note(r.id) } }),
                    )
                  }
                >
                  Yerinde bırak
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={note(r.id).length < 3}
                  onClick={() =>
                    critical("İçerik yayından kaldırılacak.", () =>
                      reportFn({ data: { id: r.id, decision: "removed", reason: note(r.id) } }),
                    )
                  }
                >
                  Kaldır
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={box}>
        <h3 className="font-semibold">Veri ihlali kaydı</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Kurula ve ilgili kişilere bildirim yükümlülüğü ve süresi hukukçu tarafından
          değerlendirilmelidir; bu kayıt değerlendirmeyi belgeler.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Etkilenen sistem"
            value={inc.system}
            onChange={(e) => setInc({ ...inc, system: e.target.value })}
          />
          <Input
            placeholder="Veri türleri (virgülle)"
            value={inc.categories}
            onChange={(e) => setInc({ ...inc, categories: e.target.value })}
          />
          <Input
            placeholder="Tahmini etkilenen kişi"
            inputMode="numeric"
            value={inc.count}
            onChange={(e) => setInc({ ...inc, count: e.target.value.replace(/\D/g, "") })}
          />
          <Input
            placeholder="Alınan önlemler"
            value={inc.measures}
            onChange={(e) => setInc({ ...inc, measures: e.target.value })}
          />
        </div>
        <Button
          className="mt-2"
          size="sm"
          disabled={inc.system.trim().length < 2}
          onClick={() =>
            run.mutate(async () => {
              await incidentFn({
                data: {
                  affectedSystem: inc.system,
                  dataCategories: inc.categories
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  affectedCountEstimate: inc.count ? Number(inc.count) : null,
                  occurredAt: null,
                  measures: inc.measures.trim() || null,
                },
              });
              setInc({ system: "", categories: "", count: "", measures: "" });
            })
          }
        >
          Olayı kaydet
        </Button>
        <ul className="mt-3 space-y-2">
          {data.incidents.map((i) => (
            <li key={i.id} className={item}>
              <p className="font-semibold">
                {i.affected_system} · {i.status}
              </p>
              <p className="text-xs text-muted-foreground">
                Tespit: {new Date(i.detected_at).toLocaleString("tr-TR")}
              </p>
              {i.status !== "closed" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["contained", "closed"] as const).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run.mutate(() =>
                          incidentUpdateFn({
                            data: {
                              id: i.id,
                              status: s,
                              notificationAssessment: note(i.id) || null,
                              authorityNotified: false,
                              subjectsNotified: false,
                            },
                          }),
                        )
                      }
                    >
                      {s === "contained" ? "Kontrol altında" : "Kapat"}
                    </Button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
