import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createComplaint,
  getMyMarketingConsents,
  listMyComplaints,
  setMarketingConsent,
} from "@/lib/compliance.functions";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CHANNELS = [
  ["email", "E-posta"],
  ["sms", "SMS"],
  ["push", "Anlık bildirim"],
] as const;

/** Pazarlama izinleri (hizmet iletilerinden ayrı) ve şikâyetler. */
export function PrivacyCenterSection() {
  const fetchConsents = useServerFn(getMyMarketingConsents);
  const saveConsent = useServerFn(setMarketingConsent);
  const fetchComplaints = useServerFn(listMyComplaints);
  const submitComplaint = useServerFn(createComplaint);
  const qc = useQueryClient();
  const consents = useQuery({ queryKey: ["marketing-consents"], queryFn: () => fetchConsents() });
  const complaints = useQuery({ queryKey: ["my-complaints"], queryFn: () => fetchComplaints() });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const toggle = useMutation({
    mutationFn: (v: { channel: "email" | "sms" | "push"; granted: boolean }) =>
      saveConsent({ data: { ...v, source: "account" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-consents"] }),
    onError: (e) => toast.error(toPublicErrorMessage(e, "Tercih kaydedilemedi.")),
  });
  const complain = useMutation({
    mutationFn: () => submitComplaint({ data: { orderId: null, subject, body } }),
    onSuccess: async () => {
      toast.success("Şikâyetiniz alındı.");
      setSubject("");
      setBody("");
      await qc.invalidateQueries({ queryKey: ["my-complaints"] });
    },
    onError: (e) => toast.error(toPublicErrorMessage(e, "Şikâyet gönderilemedi.")),
  });

  return (
    <section className="mt-8 space-y-6 rounded-3xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Ticari ileti tercihleri</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sipariş ve güvenlik bildirimleri her zaman gönderilir. Kampanya iletileri yalnızca izin
          verdiğiniz kanaldan gönderilir.
        </p>
        <div className="mt-3 space-y-2">
          {CHANNELS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={Boolean(consents.data?.consents[key])}
                disabled={toggle.isPending || consents.isLoading}
                onChange={(e) => toggle.mutate({ channel: key, granted: e.target.checked })}
              />
              {label} ile kampanya iletisi almak istiyorum
            </label>
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Şikâyetlerim</h2>
        <div className="mt-3 space-y-2">
          <Input placeholder="Konu" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea placeholder="Açıklama" value={body} onChange={(e) => setBody(e.target.value)} />
          <Button
            className="rounded-full"
            disabled={complain.isPending || subject.trim().length < 3 || body.trim().length < 10}
            onClick={() => complain.mutate()}
          >
            Şikâyet oluştur
          </Button>
        </div>
        <ul className="mt-4 space-y-1 text-sm">
          {(complaints.data ?? []).map((c) => (
            <li key={c.id} className="flex justify-between">
              <span>{c.subject}</span>
              <span className="text-muted-foreground">{c.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
