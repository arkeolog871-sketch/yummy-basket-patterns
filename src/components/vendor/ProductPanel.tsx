import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/vendor/EmptyState";
import { ImageDropzone, readImageFile, type PickedImage } from "@/components/vendor/ImageDropzone";
import { formatPrice } from "@/lib/format";
import {
  createVendorCategory,
  createVendorProduct,
  deleteVendorProduct,
  updateVendorProduct,
} from "@/lib/vendor-media.functions";

export type VendorProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  category_id: string | null;
  image_url: string | null;
  stock_quantity: number;
  is_available: boolean;
  is_popular: boolean;
};

export type VendorCategory = { id: string; name: string };

type FormState = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  stockQuantity: string;
  imageUrl: string;
  isAvailable: boolean;
  isPopular: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  price: "",
  categoryId: "none",
  stockQuantity: "0",
  imageUrl: "",
  isAvailable: true,
  isPopular: false,
};

export function ProductPanel({
  items,
  categories,
  onChanged,
}: {
  items: VendorProduct[];
  categories: VendorCategory[];
  onChanged: () => void;
}) {
  const createProduct = useServerFn(createVendorProduct);
  const updateProduct = useServerFn(updateVendorProduct);
  const removeProduct = useServerFn(deleteVendorProduct);
  const addCategory = useServerFn(createVendorCategory);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VendorProduct | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VendorProduct | null>(null);
  const [newCategory, setNewCategory] = useState("");

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPicked(null);
    setDialogOpen(true);
  }

  function openEdit(product: VendorProduct) {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description ?? "",
      price: String(Number(product.price)),
      categoryId: product.category_id ?? "none",
      stockQuantity: String(product.stock_quantity ?? 0),
      imageUrl: product.image_url ?? "",
      isAvailable: product.is_available,
      isPopular: product.is_popular,
    });
    setPicked(null);
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const price = Number(form.price.replace(",", "."));
      const stock = Number(form.stockQuantity);
      if (!Number.isFinite(price) || price < 0) throw new Error("Geçerli bir fiyat girin.");
      if (!Number.isInteger(stock) || stock < 0) throw new Error("Geçerli bir stok miktarı girin.");

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        categoryId: form.categoryId === "none" ? null : form.categoryId,
        stockQuantity: stock,
        imageUrl: form.imageUrl.trim() || null,
        image: picked
          ? {
              fileName: picked.fileName,
              contentType: picked.contentType,
              base64: picked.base64,
            }
          : null,
        isAvailable: form.isAvailable,
        isPopular: form.isPopular,
      };

      return editing
        ? updateProduct({ data: { ...payload, id: editing.id } })
        : createProduct({ data: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "Ürün güncellendi" : "Ürün başarıyla eklendi");
      setDialogOpen(false);
      setPicked(null);
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeProduct({ data: { id } }),
    onSuccess: () => {
      toast.success("Ürün silindi");
      setDeleteTarget(null);
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const categoryMutation = useMutation({
    mutationFn: (name: string) => addCategory({ data: { name } }),
    onSuccess: () => {
      toast.success("Kategori eklendi");
      setNewCategory("");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handlePick(files: File[]) {
    const file = files[0];
    if (!file) return;
    try {
      setPicked(await readImageFile(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görsel okunamadı");
    }
  }

  const previewSrc = picked?.previewUrl ?? (form.imageUrl.trim() || null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-5 shadow-card">
        <div>
          <p className="font-semibold">Ürün yönetimi</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ürün ekleyin, fiyat ve stok bilgisini güncelleyin, görsel yükleyin.
          </p>
        </div>
        <Button className="rounded-full" onClick={openCreate}>
          <Plus className="size-4" /> Yeni ürün
        </Button>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-3xl border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (newCategory.trim().length < 2) {
            toast.error("Kategori adı en az 2 karakter olmalı.");
            return;
          }
          categoryMutation.mutate(newCategory.trim());
        }}
      >
        <div className="min-w-[220px] flex-1 space-y-2">
          <Label htmlFor="new-category">Yeni kategori</Label>
          <Input
            id="new-category"
            placeholder="Örn. Ana yemekler"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            className="rounded-xl"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          className="rounded-full"
          disabled={categoryMutation.isPending}
        >
          {categoryMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Kategori ekle
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Henüz ürün eklenmemiş"
          description="“Yeni ürün” butonuna basarak menünüze ilk ürünü ekleyin."
          icon={<Package className="size-5" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <div
              key={product.id}
              className="overflow-hidden rounded-3xl border border-border bg-card shadow-card"
            >
              <div className="aspect-[4/3] w-full bg-muted">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={`${product.name} ürün görseli`}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                    Görsel yok
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{product.name}</p>
                  <p className="whitespace-nowrap font-semibold">
                    {formatPrice(Number(product.price))}
                  </p>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {product.description || "Açıklama eklenmemiş"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {product.category_id
                    ? (categoryNames.get(product.category_id) ?? "Kategori")
                    : "Kategorisiz"}{" "}
                  · Stok: {product.stock_quantity ?? 0} ·{" "}
                  {product.is_available ? "Stokta var" : "Stokta yok"}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => openEdit(product)}
                  >
                    <Pencil className="size-4" /> Düzenle
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-destructive"
                    onClick={() => setDeleteTarget(product)}
                  >
                    <Trash2 className="size-4" /> Sil
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ürünü düzenle" : "Yeni ürün ekle"}</DialogTitle>
            <DialogDescription>
              Ürün bilgilerini doldurun. Görsel yüklemek için alanı kullanabilir veya adres
              girebilirsiniz.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="product-name">Ürün adı</Label>
              <Input
                id="product-name"
                required
                minLength={2}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-description">Açıklama</Label>
              <Textarea
                id="product-description"
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                className="rounded-xl"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-price">Fiyat (₺)</Label>
                <Input
                  id="product-price"
                  required
                  inputMode="decimal"
                  value={form.price}
                  onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-stock">Stok miktarı</Label>
                <Input
                  id="product-stock"
                  required
                  type="number"
                  min={0}
                  value={form.stockQuantity}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, stockQuantity: event.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={form.categoryId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, categoryId: value }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kategorisiz</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Ürün görseli</Label>
              <ImageDropzone onFiles={(files) => void handlePick(files)} />
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt="Ürün görseli önizlemesi"
                  className="h-32 w-full rounded-2xl border border-border object-cover"
                />
              ) : null}
              <Input
                placeholder="veya görsel adresi (https://…)"
                value={form.imageUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-3 text-sm">
                <Switch
                  checked={form.isAvailable}
                  onCheckedChange={(value) => setForm((prev) => ({ ...prev, isAvailable: value }))}
                  aria-label="Satışta"
                />
                Satışta
              </label>
              <label className="flex items-center gap-3 text-sm">
                <Switch
                  checked={form.isPopular}
                  onCheckedChange={(value) => setForm((prev) => ({ ...prev, isPopular: value }))}
                  aria-label="Öne çıkan"
                />
                Öne çıkan
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setDialogOpen(false)}
              >
                Vazgeç
              </Button>
              <Button type="submit" className="rounded-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Yükleniyor…
                  </>
                ) : editing ? (
                  "Kaydet"
                ) : (
                  "Ürünü ekle"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => (open ? null : setDeleteTarget(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ürünü sil</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}” ürünü kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? "Siliniyor…" : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
