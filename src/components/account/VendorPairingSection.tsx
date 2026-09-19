import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toPublicErrorMessage } from "@/lib/public-error";
import { redeemPairingCode } from "@/lib/vendor-pairing.functions";

/**
 * İşletme sahibi, o anda giriş yaptığı hesabı işletmesine bağlar.
 *
 * Bu bölüm olmadan sahip, başvuruda yazdığı e-postayla açılan hesaba giriş
 * yapmak zorundaydı. Apple ile girişte bu mümkün değil: Apple gerçek
 * e-postayı vermiyor, sahip `xxxx@privaterelay.appleid.com` diye ayrı bir
 * hesap oluyor ve işletmesine hiç bağlanamıyordu — sipariş bildirimleri de
 * kimseye ulaşmıyordu.
 */
export function VendorPairingSection() {
  const redeem = useServerFn(redeemPairingCode);
  const [code, setCode] = useState("");
  const [linked, setLinked] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => redeem({ data: { code } }),
    onSuccess: (result: { restaurantName: string }) => {
      setLinked(result.restaurantName);
      setCode("");
      toast.success(`${result.restaurantName} hesabınıza bağlandı`);
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error, "Kod doğrulanamadı.")),
  });

  return (
    <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-warm text-warm-foreground">
          <Store className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">İşletme hesabımı bağla</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            İşletmeniz uygulamada kayıtlıysa, size verilen bağlama kodunu buraya yazın. Bu hesap
            işletmenize bağlanır ve siparişler bu telefona bildirim olarak düşer.
          </p>
        </div>
      </div>

      {linked ? (
        <div className="mt-4 rounded-2xl bg-success/10 p-3 text-sm">
          <p className="font-medium text-success">{linked} bu hesaba bağlandı.</p>
          <p className="mt-1 text-muted-foreground">
            Siparişleri görmek için{" "}
            <Link to="/vendor/dashboard" className="underline underline-offset-4">
              işletme paneline
            </Link>{" "}
            geçebilirsiniz. Bildirim izni sorulduğunda &ldquo;İzin Ver&rdquo; demeyi unutmayın.
          </p>
        </div>
      ) : null}

      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim().length >= 6) mutation.mutate();
        }}
      >
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="ABCD-EFGH"
          // Kod büyük harf ve rakamdan oluşuyor; telefonda otomatik
          // düzeltme/büyük harf kapalı olmalı yoksa kullanıcı doğru yazsa bile
          // klavye araya girip kodu bozuyor.
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-44 font-mono tracking-widest uppercase"
          aria-label="İşletme bağlama kodu"
        />
        <Button
          type="submit"
          className="rounded-full"
          disabled={mutation.isPending || code.trim().length < 6}
        >
          {mutation.isPending ? "Bağlanıyor…" : "Bağla"}
        </Button>
      </form>
    </section>
  );
}
