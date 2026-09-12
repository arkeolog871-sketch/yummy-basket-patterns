import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getMyDeletionRequest, requestAccountDeletion } from "@/lib/account.functions";
import { toPublicErrorMessage } from "@/lib/public-error";

const DELETION_CONFIRMATION =
  "Talebiniz alındı. Hesabınız ve verileriniz, yasal saklama süreleri gereği tutulması zorunlu kayıtlar hariç en geç 30 gün içinde silinecektir.";

export function DeleteAccountSection() {
  const fetchRequest = useServerFn(getMyDeletionRequest);
  const submitRequest = useServerFn(requestAccountDeletion);
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["account-deletion-request"],
    queryFn: () => fetchRequest(),
  });

  const create = useMutation({
    mutationFn: () => submitRequest({ data: { reason: reason.trim() || null } }),
    onSuccess: () => {
      toast.success(DELETION_CONFIRMATION);
      setReason("");
      setConfirmed(false);
      void queryClient.invalidateQueries({ queryKey: ["account-deletion-request"] });
    },
    onError: (error) => toast.error(toPublicErrorMessage(error, "Talep oluşturulamadı.")),
  });

  const pending = existing?.status === "pending";

  return (
    <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
      <p className="font-semibold">Hesabımı ve verilerimi sil</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Talebinizi gönderdiğinizde hesabınız ve kişisel verileriniz (adres, sipariş iletişim
        bilgileri, oturum kayıtları) yasal saklama süreleri gereği tutulması zorunlu kayıtlar hariç
        silinir veya anonimleştirilir. Detaylar için{" "}
        <Link to="/kvkk" className="underline underline-offset-4">
          KVKK Aydınlatma Metni
        </Link>{" "}
        ve{" "}
        <Link to="/gizlilik-politikasi" className="underline underline-offset-4">
          Gizlilik Politikası
        </Link>
        .
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : pending ? (
        <div className="mt-4 rounded-2xl border border-primary/40 bg-secondary/60 p-4 text-sm">
          <p className="font-semibold">Silme talebiniz kayıtlarımızda</p>
          <p className="mt-1 text-muted-foreground">{DELETION_CONFIRMATION}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Silme gerekçenizi yazabilirsiniz (isteğe bağlı)."
            className="rounded-2xl"
          />
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              Hesabımın ve verilerimin silinmesini talep ettiğimi, bu işlemin geri alınamayacağını
              ve sipariş geçmişime erişemeyeceğimi anlıyorum.
            </span>
          </label>
          <Button
            variant="destructive"
            className="rounded-full"
            disabled={!confirmed || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Talep gönderiliyor…" : "Silme talebi gönder"}
          </Button>
        </div>
      )}
    </section>
  );
}
