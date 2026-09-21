import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toPublicErrorMessage } from "@/lib/public-error";
import { countProductsToDelete, deleteProductsBulk } from "@/lib/product-import.functions";

/**
 * Toplu ürün silme.
 *
 * Neden gerekli: 5.000 satırlık yanlış bir liste yüklendiğinde ürünleri tek
 * tek silmek imkânsız. Aktarımın karşılığı olan geri alma yolu bu.
 *
 * Varsayılan kapsam bilerek "yalnızca aktarımla gelenler": elle girilmiş
 * ürünleri (source alanı boş olanları) kazara süpürmesin.
 */

type Scope = "imported" | "category" | "all";

const SCOPE_LABELS: Record<Scope, string> = {
  imported: "Yalnızca aktarımla gelen ürünler",
  category: "Bir kategorinin ürünleri",
  all: "Bütün ürünler",
};

const SCOPE_NOTES: Record<Scope, string> = {
  imported:
    "Excel/CSV ile yüklenmiş ürünler silinir. Panelden elle eklediğiniz ürünlere dokunulmaz.",
  category: "Seçtiğiniz kategorideki ürünler silinir; kategorinin kendisi kalır.",
  all: "Bu işletmenin bütün ürünleri silinir — elle eklediğiniz ürünler dâhil.",
};

/** Onay kutusuna yazılması gereken kelime. */
const CONFIRM_WORD = "SİL";

export function ProductBulkDeletePanel({
  restaurantId,
  categories = [],
  onDeleted,
  disabledReason,
}: {
  restaurantId: string | null;
  categories?: { id: string; name: string }[];
  onDeleted?: () => void;
  disabledReason?: string;
}) {
  const countProducts = useServerFn(countProductsToDelete);
  const deleteProducts = useServerFn(deleteProductsBulk);

  const [scope, setScope] = useState<Scope>("imported");
  const [categoryId, setCategoryId] = useState("");
  const [confirmWord, setConfirmWord] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Kategori kapsamı ancak kategori seçildiyse sorgulanabilir.
  const scopeArgs = useMemo(
    () =>
      scope === "category"
        ? categoryId
          ? ({ scope: "category", categoryId } as const)
          : null
        : ({ scope } as const),
    [scope, categoryId],
  );

  const preview = useQuery({
    queryKey: ["product-delete-count", restaurantId, scopeArgs],
    queryFn: () => countProducts({ data: { restaurantId: restaurantId!, ...scopeArgs! } }),
    enabled: Boolean(restaurantId && scopeArgs),
  });

  const count = preview.data?.count ?? 0;
  const blocked = disabledReason ?? (restaurantId ? null : "Önce bir işletme seçin.");
  const ready = !blocked && Boolean(scopeArgs) && count > 0 && confirmWord.trim() === CONFIRM_WORD;

  async function runDelete() {
    if (!restaurantId || !scopeArgs) return;
    setBusy(true);
    try {
      const response = await deleteProducts({
        data: { restaurantId, expectedCount: count, ...scopeArgs },
      });
      toast.success(`${response.deleted} ürün silindi`);
      setConfirmWord("");
      setDialogOpen(false);
      await preview.refetch();
      onDeleted?.();
    } catch (error) {
      toast.error(toPublicErrorMessage(error, "Ürünler silinemedi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-destructive/30 bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <Trash2 className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">Toplu ürün silme</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Yanlış liste yüklediyseniz ürünleri tek tek silmeniz gerekmez. Silme geri alınamaz.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Geçmiş siparişler etkilenmez: sipariş satırları ürünün adını ve fiyatını kendi içinde
            sakladığı için eski siparişler görünmeye devam eder.
          </p>
        </div>
      </div>

      {blocked ? (
        <p className="mt-4 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">{blocked}</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            {(Object.keys(SCOPE_LABELS) as Scope[]).map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-3 text-sm has-[:checked]:border-destructive/50 has-[:checked]:bg-destructive/5"
              >
                <input
                  type="radio"
                  name="bulk-delete-scope"
                  className="mt-0.5 size-4 shrink-0 accent-[var(--destructive)]"
                  checked={scope === option}
                  onChange={() => {
                    setScope(option);
                    setConfirmWord("");
                  }}
                />
                <span className="min-w-0">
                  <span className="font-medium">{SCOPE_LABELS[option]}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {SCOPE_NOTES[option]}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {scope === "category" ? (
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setConfirmWord("");
              }}
            >
              <option value="">Kategori seçin ({categories.length})</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          ) : null}

          <div className="rounded-2xl bg-muted p-3 text-sm">
            {!scopeArgs ? (
              <span className="text-muted-foreground">
                Silinecek sayıyı görmek için kategori seçin.
              </span>
            ) : preview.isFetching ? (
              <span className="text-muted-foreground">Sayılıyor…</span>
            ) : preview.isError ? (
              <span className="text-muted-foreground">Ürün sayısı okunamadı.</span>
            ) : count === 0 ? (
              <span className="text-muted-foreground">Bu kapsamda silinecek ürün yok.</span>
            ) : (
              <span>
                Silinecek: <strong className="text-destructive">{count} ürün</strong>
              </span>
            )}
          </div>

          {count > 0 ? (
            <>
              <label className="block text-sm">
                <span className="text-muted-foreground">
                  Onaylamak için <strong className="text-foreground">{CONFIRM_WORD}</strong> yazın
                </span>
                <Input
                  className="mt-1"
                  value={confirmWord}
                  onChange={(event) => setConfirmWord(event.target.value)}
                  placeholder={CONFIRM_WORD}
                  autoComplete="off"
                />
              </label>
              <Button
                variant="outline"
                className="rounded-full text-destructive"
                disabled={!ready || busy}
                onClick={() => setDialogOpen(true)}
              >
                <Trash2 className="size-4" /> {count} ürünü sil
              </Button>
            </>
          ) : null}
        </div>
      )}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-destructive" />
              {count} ürün silinecek
            </AlertDialogTitle>
            <AlertDialogDescription>
              {SCOPE_NOTES[scope]} Bu işlem geri alınamaz. Ürünleri geri getirmenin tek yolu listeyi
              yeniden yüklemektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                // Dialog kendiliğinden kapanmasın: silme bitene kadar açık
                // kalıp "siliniyor" durumunu göstersin.
                event.preventDefault();
                void runDelete();
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Evet, sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
