import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toPublicErrorMessage } from "@/lib/public-error";
import { parseImportNumber } from "@/lib/product-import";
import { blobToBase64, shrinkImage } from "@/lib/image-resize";
import type { ExtractedProduct } from "@/lib/ai-menu-import.server";
import {
  extractMenuItemsFromPhoto,
  importExtractedMenuItems,
} from "@/lib/ai-menu-import.functions";

/** Tek istekte okunabilecek en fazla fotoğraf (sunucu şemasıyla aynı). */
const MAX_PHOTOS = 4;

type PhotoItem = { dataUrl: string; name: string };
type DraftItem = ExtractedProduct & { selected: boolean };

/**
 * "Fotoğraftan ürün çıkar": satıcı menü/fiyat listesi fotoğrafı yükler,
 * yapay zekâ ürünleri okur, satıcı düzenleyip onaylar. Kayıt, onaylı
 * satırlar için sunucu fonksiyonuyla olur — fotoğraf okuma sonucu asla
 * doğrudan kataloğa yazılmaz.
 */
export function PhotoMenuImport({
  restaurantId,
  blocked,
}: {
  restaurantId: string | null;
  blocked: string | null;
}) {
  const extractFn = useServerFn(extractMenuItemsFromPhoto);
  const importFn = useServerFn(importExtractedMenuItems);
  const queryClient = useQueryClient();

  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [items, setItems] = useState<DraftItem[] | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onPickPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`Aynı anda en fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsiniz.`);
      return;
    }
    const picked: PhotoItem[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} bir görsel değil, atlandı.`);
        continue;
      }
      try {
        const shrunk = await shrinkImage(file, file.type);
        const blob = shrunk?.blob ?? file;
        const contentType = shrunk?.contentType ?? file.type;
        const base64 = await blobToBase64(blob);
        picked.push({ dataUrl: `data:${contentType};base64,${base64}`, name: file.name });
      } catch {
        toast.error(`${file.name} okunamadı, atlandı.`);
      }
    }
    if (picked.length > 0) setPhotos((prev) => [...prev, ...picked]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function onExtract() {
    if (photos.length === 0) return;
    setReading(true);
    try {
      const response = await extractFn({
        data: { restaurantId: restaurantId as string, images: photos.map((p) => p.dataUrl) },
      });
      if (response.products.length === 0) {
        toast.error(
          "Fotoğrafta ürün bulunamadı. Daha net, düz açıdan çekilmiş bir fotoğrafla deneyin.",
        );
        return;
      }
      setItems(response.products.map((product) => ({ ...product, selected: true })));
      toast.success(`${response.products.length} ürün bulundu — listeyi gözden geçirip kaydedin.`);
    } catch (error) {
      toast.error(toPublicErrorMessage(error, "Fotoğraf okunamadı."));
    } finally {
      setReading(false);
    }
  }

  async function onSave() {
    if (!items || !restaurantId) return;
    const selected = items.filter((item) => item.selected);
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const response = await importFn({
        data: {
          restaurantId,
          items: selected.map((item) => ({
            name: item.name.trim(),
            price: parseImportNumber(String(item.price ?? "")) ?? 0,
            categoryName: item.categoryName?.trim() || null,
            description: item.description?.trim() || null,
          })),
        },
      });
      toast.success(
        `${response.created} ürün eklendi, ${response.updated} ürün güncellendi`,
      );
      setItems(null);
      setPhotos([]);
      void queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["business-catalog"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    } catch (error) {
      toast.error(toPublicErrorMessage(error, "Ürünler kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev ? prev.map((item) => (item.key === key ? { ...item, ...patch } : item)) : prev,
    );
  }

  const selectedCount = items?.filter((item) => item.selected).length ?? 0;

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-warm text-warm-foreground">
          <Camera className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">Fotoğraftan ürün çıkar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Menünüzün veya fiyat listenizin fotoğrafını yükleyin — yapay zekâ ürün adı, fiyat ve
            kategoriyi okur. Listeyi gözden geçirip düzelttikten sonra kaydedersiniz; hiçbir şey
            otomatik olarak kataloğa yazılmaz.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Aynı ada sahip ürünün fiyatı güncellenir; elle girdiğiniz açıklama ve görsel korunur.
          </p>
        </div>
      </div>

      {blocked ? (
        <p className="mt-4 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">{blocked}</p>
      ) : (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void onPickPhotos(event.target.files)}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => fileInput.current?.click()}
              disabled={reading || saving || photos.length >= MAX_PHOTOS}
            >
              <ImagePlus className="size-4" /> Fotoğraf ekle
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={() => void onExtract()}
              disabled={reading || saving || photos.length === 0}
            >
              {reading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              {reading ? "Okunuyor…" : "Ürünleri çıkar"}
            </Button>
            {photos.length > 0 && !reading ? (
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={() => {
                  setPhotos([]);
                  setItems(null);
                }}
                disabled={saving}
              >
                Temizle
              </Button>
            ) : null}
          </div>

          {photos.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <div key={`${photo.name}-${index}`} className="relative">
                  <img
                    src={photo.dataUrl}
                    alt={photo.name}
                    className="size-20 rounded-xl border border-border object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Fotoğrafı kaldır"
                    className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-foreground text-background"
                    onClick={() => {
                      setPhotos((prev) => prev.filter((_, i) => i !== index));
                      setItems(null);
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {items ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  Bulunan ürünler ({items.length}) — gözden geçirin
                </p>
                <p className="text-xs text-muted-foreground">Fiyatsız bulunanlar 0 olarak kaydedilir</p>
              </div>
              <div className="mt-2 max-h-96 space-y-1.5 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-2"
                  >
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(event) => updateItem(item.key, { selected: event.target.checked })}
                      aria-label={`${item.name} seçili`}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <Input
                      className="h-9 min-w-0 flex-1 basis-48"
                      value={item.name}
                      onChange={(event) => updateItem(item.key, { name: event.target.value })}
                      aria-label="Ürün adı"
                    />
                    <Input
                      className="h-9 w-24 shrink-0"
                      inputMode="decimal"
                      value={item.price === null ? "" : String(item.price)}
                      placeholder="Fiyat"
                      onChange={(event) =>
                        updateItem(item.key, {
                          price: event.target.value === "" ? null : parseImportNumber(event.target.value),
                        })
                      }
                      aria-label="Fiyat"
                    />
                    <Input
                      className="h-9 w-36 shrink-0"
                      value={item.categoryName ?? ""}
                      placeholder="Kategori"
                      onChange={(event) => updateItem(item.key, { categoryName: event.target.value })}
                      aria-label="Kategori"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 rounded-full text-muted-foreground"
                      aria-label="Satırı çıkar"
                      onClick={() =>
                        setItems((prev) => (prev ? prev.filter((row) => row.key !== item.key) : prev))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => void onSave()}
                  disabled={saving || selectedCount === 0}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {selectedCount} ürünü kaydet
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setItems(null)}
                  disabled={saving}
                >
                  Vazgeç
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
