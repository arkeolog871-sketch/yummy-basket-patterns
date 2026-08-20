import { useState, type ComponentType } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import * as Icons from "lucide-react";
import { useAppCategories, type AppCategory } from "@/hooks/useTaxonomy";
import { saveCategory, deleteCategory, moveCategory } from "@/lib/taxonomy.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const ICON_OPTIONS = [
  "UtensilsCrossed",
  "ChefHat",
  "Coffee",
  "PartyPopper",
  "ShoppingCart",
  "Shirt",
  "Pizza",
  "IceCream",
  "Flower2",
  "Dumbbell",
  "Gift",
  "Sparkles",
] as const;

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const registry = Icons as unknown as Record<
    string,
    ComponentType<{ className?: string }> | undefined
  >;
  const Component = registry[name] ?? registry["Sparkles"]!;
  return className ? <Component className={className} /> : <Component />;
}

const emptyForm = {
  slug: "",
  label: "",
  icon: "UtensilsCrossed",
  position: 0,
  is_active: true,
};

export function CategoryPanel({ businesses }: { businesses: { sector: string }[] }) {
  const { categories } = useAppCategories({ includeHidden: true });
  const queryClient = useQueryClient();
  const save = useServerFn(saveCategory);
  const remove = useServerFn(deleteCategory);
  const move = useServerFn(moveCategory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["app-categories"] });
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(editingId ? { id: editingId } : {}),
          slug: form.slug,
          label: form.label,
          icon: form.icon,
          position: Number(form.position),
          is_active: form.is_active,
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? "Kategori güncellendi" : "Kategori eklendi");
      setEditingId(null);
      setForm(emptyForm);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Kategori silindi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const moveMutation = useMutation({
    mutationFn: (input: { id: string; direction: "up" | "down" }) => move({ data: input }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  function startEdit(category: AppCategory) {
    setEditingId(category.id);
    setForm({
      slug: category.slug,
      label: category.label,
      icon: category.icon,
      position: category.position,
      is_active: category.is_active,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <form
        className="space-y-4 rounded-3xl border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <p className="text-sm font-semibold">
          {editingId ? "Kategoriyi düzenle" : "Yeni kategori ekle"}
        </p>
        <div>
          <Label htmlFor="cat-label">Görünen ad</Label>
          <Input
            id="cat-label"
            className="mt-1.5"
            required
            value={form.label}
            onChange={(event) => setForm({ ...form, label: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="cat-slug">URL adı</Label>
          <Input
            id="cat-slug"
            className="mt-1.5"
            required
            placeholder="ornek-kategori"
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: event.target.value })}
          />
        </div>
        <div>
          <Label>İkon</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ICON_OPTIONS.map((icon) => (
              <button
                key={icon}
                type="button"
                aria-label={icon}
                onClick={() => setForm({ ...form, icon })}
                className={`flex size-10 items-center justify-center rounded-xl border transition-colors ${
                  form.icon === icon
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <CategoryIcon name={icon} className="size-4" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="cat-position">Sıra</Label>
          <Input
            id="cat-position"
            type="number"
            min={0}
            className="mt-1.5"
            value={form.position}
            onChange={(event) => setForm({ ...form, position: Number(event.target.value) })}
          />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border p-3">
          <span className="text-sm">Yayında</span>
          <Switch
            checked={form.is_active}
            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="rounded-full" disabled={saveMutation.isPending}>
            <Plus className="size-4" /> {editingId ? "Kaydet" : "Ekle"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Vazgeç
            </Button>
          ) : null}
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {categories.map((category, index) => (
          <div
            key={category.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4 last:border-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-warm text-warm-foreground">
                <CategoryIcon name={category.icon} className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {category.label}
                  {category.is_active ? null : (
                    <span className="ml-2 text-xs text-muted-foreground">(gizli)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  /{category.slug} ·{" "}
                  {businesses.filter((business) => business.sector === category.slug).length}{" "}
                  işletme
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                aria-label="Yukarı taşı"
                disabled={index === 0 || moveMutation.isPending}
                onClick={() => moveMutation.mutate({ id: category.id, direction: "up" })}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                aria-label="Aşağı taşı"
                disabled={index === categories.length - 1 || moveMutation.isPending}
                onClick={() => moveMutation.mutate({ id: category.id, direction: "down" })}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                aria-label="Düzenle"
                onClick={() => startEdit(category)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                aria-label="Sil"
                onClick={() => deleteMutation.mutate(category.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}