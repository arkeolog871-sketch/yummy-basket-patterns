import { useState, type ComponentType } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Trash2,
  // Yeme-içme
  UtensilsCrossed,
  ChefHat,
  Coffee,
  Pizza,
  Sandwich,
  Cake,
  Croissant,
  IceCream,
  Fish,
  Beef,
  Wheat,
  Carrot,
  Apple,
  Milk,
  // Alışveriş
  ShoppingCart,
  Store,
  Shirt,
  Footprints,
  Glasses,
  Watch,
  Gift,
  Package,
  Sofa,
  // Kişisel bakım ve sağlık
  Scissors,
  SprayCan,
  Flower2,
  Stethoscope,
  Pill,
  Dumbbell,
  // Zanaat ve teknik
  Wrench,
  Hammer,
  Drill,
  Flame,
  Paintbrush,
  Plug,
  Zap,
  Droplet,
  Key,
  // Ulaşım ve lojistik
  Truck,
  Car,
  Bike,
  Fuel,
  Warehouse,
  // Teknoloji
  Laptop,
  Smartphone,
  Cpu,
  Camera,
  // Tarım ve hayvancılık
  Tractor,
  PawPrint,
  Egg,
  TreePine,
  Leaf,
  // Diğer
  PartyPopper,
  Music,
  BookOpen,
  GraduationCap,
  Baby,
  Home,
  Building2,
  Sparkles,
} from "lucide-react";
import { useAppCategories, type AppCategory } from "@/hooks/useTaxonomy";
import { saveCategory, deleteCategory, moveCategory } from "@/lib/taxonomy.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/lib/format";

/**
 * Liste uygulamanın gerçekten barındırdığı sektörlere göre seçildi. Önceki
 * on iki ikon yalnızca yeme-içmeyi kapsıyordu; kaynak ustası, nakliyeci,
 * tesisatçı veya bilişimci ekleyen sayfa yöneticisi kategorisine uyan bir
 * simge bulamayıp alakasız bir yemek ikonu seçmek zorunda kalıyordu.
 *
 * İkonlar tek tek içe aktarılıyor: `import * as Icons` tüm kütüphaneyi bu
 * panelin paketine gömerdi.
 */
const ICON_GROUPS = [
  {
    label: "Yeme-içme",
    icons: [
      "UtensilsCrossed",
      "ChefHat",
      "Coffee",
      "Pizza",
      "Sandwich",
      "Cake",
      "Croissant",
      "IceCream",
      "Fish",
      "Beef",
      "Wheat",
      "Carrot",
      "Apple",
      "Milk",
    ],
  },
  {
    label: "Alışveriş",
    icons: [
      "ShoppingCart",
      "Store",
      "Shirt",
      "Footprints",
      "Glasses",
      "Watch",
      "Gift",
      "Package",
      "Sofa",
    ],
  },
  {
    label: "Kişisel bakım ve sağlık",
    icons: ["Scissors", "SprayCan", "Flower2", "Stethoscope", "Pill", "Dumbbell"],
  },
  {
    label: "Zanaat ve teknik",
    icons: ["Wrench", "Hammer", "Drill", "Flame", "Paintbrush", "Plug", "Zap", "Droplet", "Key"],
  },
  {
    label: "Ulaşım ve lojistik",
    icons: ["Truck", "Car", "Bike", "Fuel", "Warehouse"],
  },
  {
    label: "Teknoloji",
    icons: ["Laptop", "Smartphone", "Cpu", "Camera"],
  },
  {
    label: "Tarım ve hayvancılık",
    icons: ["Tractor", "PawPrint", "Egg", "TreePine", "Leaf"],
  },
  {
    label: "Diğer",
    icons: [
      "PartyPopper",
      "Music",
      "BookOpen",
      "GraduationCap",
      "Baby",
      "Home",
      "Building2",
      "Sparkles",
    ],
  },
] as const;

/** Yalnızca kullanılan ikonları içe aktarır — `import * as Icons` tüm ikon
 * kütüphanesini bu (kurucu paneline özel) paketin içine gömüyordu. */
const ICON_REGISTRY: Record<string, ComponentType<{ className?: string }>> = {
  UtensilsCrossed,
  ChefHat,
  Coffee,
  Pizza,
  Sandwich,
  Cake,
  Croissant,
  IceCream,
  Fish,
  Beef,
  Wheat,
  Carrot,
  Apple,
  Milk,
  ShoppingCart,
  Store,
  Shirt,
  Footprints,
  Glasses,
  Watch,
  Gift,
  Package,
  Sofa,
  Scissors,
  SprayCan,
  Flower2,
  Stethoscope,
  Pill,
  Dumbbell,
  Wrench,
  Hammer,
  Drill,
  Flame,
  Paintbrush,
  Plug,
  Zap,
  Droplet,
  Key,
  Truck,
  Car,
  Bike,
  Fuel,
  Warehouse,
  Laptop,
  Smartphone,
  Cpu,
  Camera,
  Tractor,
  PawPrint,
  Egg,
  TreePine,
  Leaf,
  PartyPopper,
  Music,
  BookOpen,
  GraduationCap,
  Baby,
  Home,
  Building2,
  Sparkles,
};

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Component = ICON_REGISTRY[name] ?? Sparkles;
  return className ? <Component className={className} /> : <Component />;
}

const emptyForm = {
  slug: "",
  label: "",
  icon: "UtensilsCrossed",
  position: 0,
  is_active: true,
};

/**
 * Yeni kategori listenin sonuna gelmeli. Sabit 0 ile açılınca her yeni
 * kategori aynı konumu alıyor ve eşitlik durumunda sıralama belirsizleşiyordu
 * -- üretimde yedi kategori birden position=0 taşıyordu.
 */
function nextFormFor(count: number) {
  return { ...emptyForm, position: count };
}

export function CategoryPanel({ businesses }: { businesses: { sector: string | null }[] }) {
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
      setForm(nextFormFor(categories.length));
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Kategori silindi");
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const moveMutation = useMutation({
    mutationFn: (input: { id: string; direction: "up" | "down" }) => move({ data: input }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
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
        <p className="text-xs text-muted-foreground">
          Renk otomatik atanır: yeni kategori, mevcut kategorilerden gözle en ayrışan ve okunaklı
          rengi alır. Var olan kategorilerin rengi değişmez.
        </p>
        <div>
          <Label htmlFor="cat-label">Görünen ad</Label>
          <Input
            id="cat-label"
            className="mt-1.5"
            required
            value={form.label}
            onChange={(event) => {
              const label = event.target.value;
              setForm((current) => ({
                ...current,
                label,
                slug:
                  editingId || current.slug !== slugify(current.label)
                    ? current.slug
                    : slugify(label),
              }));
            }}
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
            onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
          />
        </div>
        <div>
          <Label>İkon</Label>
          <div className="mt-1.5 space-y-3">
            {ICON_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-xs text-muted-foreground">{group.label}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {group.icons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      aria-label={icon}
                      title={icon}
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
                setForm(nextFormFor(categories.length));
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
                  {
                    businesses.filter((business) => (business.sector ?? "") === category.slug)
                      .length
                  }{" "}
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
