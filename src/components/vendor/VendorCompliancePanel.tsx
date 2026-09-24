import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { acceptVendorAgreement, getVendorCompliance } from "@/lib/compliance.functions";
import { LEGAL_DOCUMENTS } from "@/lib/legal";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";

/** İşletme: sözleşme sürümü onayı, doğrulama durumu, bedel dökümü. */
export function VendorCompliancePanel() {
  const fetchState = useServerFn(getVendorCompliance);
  const accept = useServerFn(acceptVendorAgreement);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["vendor-compliance"], queryFn: () => fetchState() });
  const mutate = useMutation({
    mutationFn: () => accept(),
    onSuccess: async () => {
      toast.success("Sözleşme onayınız kaydedildi.");
      await qc.invalidateQueries({ queryKey: ["vendor-compliance"] });
    },
  });
  if (!data) return null;
  const outdated = (data.acceptedVersion ?? 0) < data.currentAgreementVersion;
  const monthly = new Map<string, number>();
  for (const fee of data.fees) {
    const key = `${fee.created_at.slice(0, 7)} · ${fee.fee_type}`;
    monthly.set(key, (monthly.get(key) ?? 0) + Number(fee.amount));
  }
  return (
    <div className="space-y-4">
      {outdated ? (
        <div className="rounded-3xl border border-primary/40 bg-card p-4">
          <p className="font-semibold">{LEGAL_DOCUMENTS.vendor_agreement.title} — sürüm {data.currentAgreementVersion}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Güncel sözleşmeyi okuyup onaylamanız gerekiyor.{" "}
            <a href={LEGAL_DOCUMENTS.vendor_agreement.path} target="_blank" rel="noreferrer" className="underline">
              Sözleşmeyi oku
            </a>
          </p>
          <Button className="mt-3 rounded-full" disabled={mutate.isPending} onClick={() => mutate.mutate()}>
            Okudum, onaylıyorum
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sözleşme sürüm {data.acceptedVersion} onaylı.</p>
      )}
      <div className="rounded-3xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold">Doğrulama durumu: {data.verificationStatus}</p>
        {data.verificationNote ? <p className="text-muted-foreground">{data.verificationNote}</p> : null}
        <p className="mt-2 text-muted-foreground">
          Belgeler: {data.documents.length ? data.documents.map((d) => `${d.doc_kind} (${d.status})`).join(", ") : "henüz yok"}
        </p>
      </div>
      <div className="rounded-3xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold">Platform bedelleri (aylık, kalem bazında)</p>
        {monthly.size === 0 ? (
          <p className="text-muted-foreground">Platform şu an sizden bedel tahsil etmiyor.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {[...monthly.entries()].map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span>{formatPrice(v)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
