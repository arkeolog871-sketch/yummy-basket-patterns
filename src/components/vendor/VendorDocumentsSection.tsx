import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BUSINESS_DOC_KINDS,
  listMyBusinessDocuments,
  submitBusinessDocument,
  type BusinessDocKind,
} from "@/lib/compliance-review.functions";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VendorReviewReplies } from "./VendorReviewReplies";

const STATUS: Record<string, string> = {
  submitted: "İncelemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  expired: "Süresi doldu",
};
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** İşletme: zorunlu belgelerin yüklenmesi ve inceleme durumu. */
export function VendorDocumentsSection() {
  const list = useServerFn(listMyBusinessDocuments);
  const submit = useServerFn(submitBusinessDocument);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["vendor-docs"], queryFn: () => list() });
  const [kind, setKind] = useState<BusinessDocKind>("tax_certificate");
  const [docNo, setDocNo] = useState("");
  const [expires, setExpires] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!data || !file) throw new Error("Dosya seçin.");
      if (!ALLOWED.includes(file.type)) throw new Error("Yalnız PDF veya fotoğraf yükleyin.");
      if (file.size > 10 * 1024 * 1024) throw new Error("Dosya 10 MB'tan büyük olamaz.");
      const ext =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "pdf";
      const path = `${data.restaurantId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("business-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error("Dosya yüklenemedi.");
      await submit({
        data: {
          docKind: kind,
          storagePath: path,
          documentNo: docNo.trim() || null,
          expiresAt: expires || null,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Belge incelemeye gönderildi.");
      setFile(null);
      setDocNo("");
      setExpires("");
      await qc.invalidateQueries({ queryKey: ["vendor-docs"] });
      await qc.invalidateQueries({ queryKey: ["vendor-compliance"] });
    },
    onError: (e) => toast.error(toPublicErrorMessage(e)),
  });

  if (!data) return null;
  return (
    <>
      <section className="rounded-3xl border border-border/70 bg-card p-4 shadow-card">
        <h3 className="font-semibold">İşletme belgeleri</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Yayında kalmak için zorunlu belgeler:{" "}
          {data.required.map((k) => BUSINESS_DOC_KINDS[k as BusinessDocKind] ?? k).join(", ")}.
          Belgeler yalnız sizin ve platform yetkilisinin görebileceği gizli alanda saklanır.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            Belge türü
            <select
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2"
              value={kind}
              onChange={(e) => setKind(e.target.value as BusinessDocKind)}
            >
              {Object.entries(BUSINESS_DOC_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Belge numarası (varsa)
            <Input value={docNo} maxLength={80} onChange={(e) => setDocNo(e.target.value)} />
          </label>
          <label className="text-sm">
            Geçerlilik bitişi (varsa)
            <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </label>
          <label className="text-sm">
            Dosya (PDF/JPG/PNG, en çok 10 MB)
            <Input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <Button
          className="mt-3"
          disabled={!file || upload.isPending}
          onClick={() => upload.mutate()}
        >
          {upload.isPending ? "Yükleniyor…" : "İncelemeye gönder"}
        </Button>
        <ul className="mt-4 space-y-2 text-sm">
          {data.documents.map((d) => (
            <li key={d.id} className="rounded-2xl border border-border/60 p-3">
              <div className="flex justify-between gap-2">
                <span>{BUSINESS_DOC_KINDS[d.doc_kind as BusinessDocKind] ?? d.doc_kind}</span>
                <span className="font-semibold">{STATUS[d.status] ?? d.status}</span>
              </div>
              {d.expires_at ? (
                <p className="text-xs text-muted-foreground">Geçerlilik: {d.expires_at}</p>
              ) : null}
              {d.review_note ? (
                <p className="mt-1 text-xs text-muted-foreground">Not: {d.review_note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <VendorReviewReplies restaurantId={data.restaurantId} />
    </>
  );
}
