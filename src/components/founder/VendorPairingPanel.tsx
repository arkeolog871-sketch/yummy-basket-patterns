import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, BellOff, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toPublicErrorMessage } from "@/lib/public-error";
import {
  createPairingCode,
  formatPairingCode,
  getPairingStatus,
} from "@/lib/vendor-pairing.functions";

/**
 * İşletmenin bildirim alıp alamadığını gösterir ve alamıyorsa çözümü verir.
 *
 * "Bildirim alamayan işletme" uyarısının tek gerçek sebebi, işletme sahibinin
 * uygulamada kullandığı hesabın işletmeye bağlı olmaması. Apple ile girişte
 * bu neredeyse kaçınılmaz: Apple gerçek e-postayı vermediği için sahip
 * `xxxx@privaterelay.appleid.com` diye ayrı bir hesap olarak açılıyor.
 * Eşleştirme kodu, e-posta eşleşmesine gerek bırakmadan bağlamayı sağlıyor.
 */
export function VendorPairingPanel({ restaurantId }: { restaurantId: string | null }) {
  const fetchStatus = useServerFn(getPairingStatus);
  const createCode = useServerFn(createPairingCode);
  const [copied, setCopied] = useState(false);

  const status = useQuery({
    queryKey: ["vendor-pairing", restaurantId],
    queryFn: () => fetchStatus({ data: { restaurantId: restaurantId! } }),
    enabled: Boolean(restaurantId),
  });

  const generate = useMutation({
    mutationFn: () => createCode({ data: { restaurantId: restaurantId! } }),
    onSuccess: () => {
      setCopied(false);
      toast.success("Yeni kod üretildi");
      void status.refetch();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error, "Kod üretilemedi.")),
  });

  if (!restaurantId) {
    return (
      <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
        Bildirim durumunu görmek için bir işletme seçin.
      </p>
    );
  }

  const data = status.data;
  const code = data?.code ?? null;

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(formatPairingCode(code));
      setCopied(true);
    } catch {
      toast.error("Kopyalanamadı, kodu elle yazın.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
            data?.reachable
              ? "bg-success text-success-foreground"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {data?.reachable ? <BellRing className="size-5" /> : <BellOff className="size-5" />}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">
            {status.isLoading
              ? "Kontrol ediliyor…"
              : data?.reachable
                ? "Bu işletme bildirim alabiliyor"
                : "Bu işletme bildirim ALAMIYOR"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.reachable
              ? "Bağlı hesaplardan en az birinin kayıtlı cihazı var; siparişler telefona düşüyor."
              : "Buraya düşen sipariş kimseye ulaşmaz. Sahibin uygulamada kullandığı hesabı aşağıdaki kodla işletmeye bağlayın."}
          </p>
        </div>
      </div>

      {data && data.accounts.length > 0 ? (
        <div className="rounded-2xl border border-border/70 p-3">
          <p className="text-xs font-medium text-muted-foreground">Bu işletmeye bağlı hesaplar</p>
          <ul className="mt-2 space-y-1 text-sm">
            {data.accounts.map((account) => (
              <li key={account.userId} className="flex items-center justify-between gap-3">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {account.fullName ?? "Adı girilmemiş hesap"}
                </span>
                <span
                  className={`shrink-0 text-xs ${
                    account.reachable ? "text-success" : "text-muted-foreground"
                  }`}
                >
                  {account.reachable ? "cihaz kayıtlı" : "cihaz yok"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70 p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="size-4" /> İşletme hesabı bağlama kodu
        </p>
        {code ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded-xl bg-muted px-3 py-2 font-mono text-lg tracking-widest">
                {formatPairingCode(code)}
              </code>
              <Button type="button" variant="outline" className="rounded-full" onClick={copyCode}>
                <Copy className="size-4" /> {copied ? "Kopyalandı" : "Kopyala"}
              </Button>
            </div>
            {data?.expiresAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Geçerlilik: {new Date(data.expiresAt).toLocaleDateString("tr")} tarihine kadar
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Henüz kod üretilmedi (veya süresi doldu).
          </p>
        )}

        <p className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          İşletme sahibine şunu söyleyin:{" "}
          <strong>uygulamayı açıp her zamanki gibi giriş yapsın</strong> (Google/Apple fark etmez),
          sonra <strong>Hesabım → Hesap</strong> bölümünde &ldquo;İşletme hesabımı bağla&rdquo;
          alanına bu kodu yazsın. Bildirim izni sorulursa &ldquo;İzin Ver&rdquo; demesi gerekir.
        </p>

        <Button
          type="button"
          className="mt-3 rounded-full"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          {code ? "Yeni kod üret" : "Kod üret"}
        </Button>
      </div>
    </div>
  );
}
