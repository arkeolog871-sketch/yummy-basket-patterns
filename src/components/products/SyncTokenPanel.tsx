import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2, Plug, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toPublicErrorMessage } from "@/lib/public-error";
import { formatDateTime } from "@/lib/format";
import { createSyncToken, listSyncTokens, revokeSyncToken } from "@/lib/sync-token.functions";

/**
 * Otomatik senkron jetonları.
 *
 * Jeton bir paroladır: üretildiği an bir kez gösterilir, sunucuda yalnızca
 * özeti durur. Bu yüzden arayüz "kopyala" adımını öne çıkarıyor ve pencereyi
 * kullanıcı kapatana kadar açık tutuyor.
 */
export function SyncTokenPanel({
  restaurantId,
  disabledReason,
}: {
  restaurantId: string | null;
  disabledReason?: string;
}) {
  const fetchTokens = useServerFn(listSyncTokens);
  const create = useServerFn(createSyncToken);
  const revoke = useServerFn(revokeSyncToken);

  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const tokens = useQuery({
    queryKey: ["sync-tokens", restaurantId],
    queryFn: () => fetchTokens({ data: { restaurantId: restaurantId! } }),
    enabled: Boolean(restaurantId),
  });

  const blocked = disabledReason ?? (restaurantId ? null : "Önce bir işletme seçin.");

  async function onCreate() {
    if (!restaurantId) return;
    setBusy(true);
    try {
      const response = await create({
        data: { restaurantId, label: label.trim() || null },
      });
      setFreshToken(response.token);
      setLabel("");
      await tokens.refetch();
    } catch (error) {
      toast.error(toPublicErrorMessage(error, "Jeton üretilemedi."));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(tokenId: string) {
    if (!restaurantId) return;
    try {
      await revoke({ data: { restaurantId, tokenId } });
      toast.success("Jeton iptal edildi");
      await tokens.refetch();
    } catch (error) {
      toast.error(toPublicErrorMessage(error, "Jeton iptal edilemedi."));
    }
  }

  async function copyToken(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Jeton kopyalandı");
    } catch {
      toast.error("Kopyalanamadı — jetonu elle seçip kopyalayın.");
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-warm text-warm-foreground">
          <Plug className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">Otomatik senkron</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Market programınızdaki fiyat ve stok değişiklikleri kendiliğinden buraya gelsin.
            Kasadaki bilgisayara küçük bir program kurulur; o program listeyi belirli aralıklarla
            gönderir.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Modem ayarı, sabit IP veya port açma gerekmez — bağlantıyı market tarafı kurar.
          </p>
        </div>
      </div>

      {blocked ? (
        <p className="mt-4 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">{blocked}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {freshToken ? (
            <div className="rounded-2xl border border-warm bg-warm/20 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <TriangleAlert className="size-4 shrink-0" />
                Bu jeton bir daha gösterilmeyecek
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Şimdi kopyalayıp köprü programının ayarına yapıştırın. Kaybederseniz yenisini üretip
                bunu iptal edersiniz. Jeton bir paroladır; mesajla paylaşmayın.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-xl bg-background px-3 py-2 text-xs">
                  {freshToken}
                </code>
                <Button size="sm" className="rounded-full" onClick={() => copyToken(freshToken)}>
                  <Copy className="size-4" /> Kopyala
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setFreshToken(null)}
                >
                  Kapat
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-sm">
              <span className="text-muted-foreground">Nerede kullanılacak? (isteğe bağlı)</span>
              <Input
                className="mt-1"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Kasa bilgisayarı"
                maxLength={80}
              />
            </label>
            <Button className="rounded-full" disabled={busy} onClick={onCreate}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Yeni jeton üret
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            {tokens.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Yükleniyor…</p>
            ) : tokens.isError ? (
              <p className="p-4 text-sm text-muted-foreground">Jetonlar okunamadı.</p>
            ) : (tokens.data?.tokens.length ?? 0) === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Henüz jeton yok. Otomatik senkron için bir jeton üretin.
              </p>
            ) : (
              tokens.data!.tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between gap-3 border-b border-border/60 p-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {token.label || "Adsız jeton"}{" "}
                      <code className="text-xs text-muted-foreground">{token.tokenPrefix}…</code>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {token.lastUsedAt
                        ? `Son gönderim: ${formatDateTime(token.lastUsedAt)}`
                        : "Henüz hiç kullanılmadı"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="shrink-0 rounded-full text-destructive"
                    aria-label="Jetonu iptal et"
                    onClick={() => onRevoke(token.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
