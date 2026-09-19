import { Fragment, useCallback, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryGroup } from "@/lib/menu-groups";

/**
 * Kategori → ürün akordeonu.
 *
 * Neden: bir markette 3.000-8.000 ürün var. Hepsini kategori başlıklarının
 * altında açık listelersek sayfa hem okunmaz hem de tarayıcıyı kilitler.
 * Kullanıcı kategoriye basar, ürünler onun altına açılır.
 *
 * KAPALI KATEGORİNİN ÜRÜNLERİ HİÇ RENDER EDİLMEZ (CSS ile gizlenmez):
 * 5.000 ürünlük bir işletmede gizlemek yetmez, DOM'a hiç girmemeleri gerekir.
 * Açılan kategori kapatılınca da DOM'dan çıkar.
 */
export function CategoryAccordion<T>({
  groups,
  renderItem,
  itemKey,
  /** Varsayılan açık kategoriler; verilmezse ilk kategori açık başlar. */
  defaultOpenIds,
  itemsClassName,
  className,
  countLabel = (count) => `${count} ürün`,
}: {
  groups: CategoryGroup<T>[];
  renderItem: (item: T) => ReactNode;
  itemKey: (item: T) => string;
  defaultOpenIds?: string[];
  itemsClassName?: string;
  className?: string;
  countLabel?: (count: number) => string;
}) {
  // İlk kategori açık başlar: sayfa hiç boş görünmesin, akordeonun açılır
  // olduğu ilk bakışta anlaşılsın. Geri kalanı kapalı.
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(defaultOpenIds ?? (groups[0] ? [groups[0].id] : [])),
  );
  const headingId = useId();

  const toggle = useCallback((id: string) => {
    setOpenIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      {groups.map((group) => {
        const isOpen = openIds.has(group.id);
        const panelId = `${headingId}-${group.id}`;
        return (
          <section
            key={group.id}
            className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card"
          >
            <h2>
              <button
                type="button"
                onClick={() => toggle(group.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50 sm:px-5"
              >
                {/* Kategori adı da kırpılmaz; uzun market kategorileri
                    ("Temizlik ve kağıt ürünleri") alt satıra sarar. */}
                <span className="min-w-0 flex-1 text-base font-semibold [overflow-wrap:anywhere] sm:text-lg">
                  {group.name}
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {countLabel(group.items.length)}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
            </h2>
            {isOpen ? (
              <div
                id={panelId}
                className={cn(
                  "animate-in fade-in slide-in-from-top-1 border-t border-border/60 p-4 duration-200 sm:p-5",
                  itemsClassName,
                )}
              >
                {group.items.map((item) => (
                  <Fragment key={itemKey(item)}>{renderItem(item)}</Fragment>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
