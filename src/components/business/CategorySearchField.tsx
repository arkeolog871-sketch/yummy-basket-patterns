import { useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { BusinessCategoryEntry } from "@/lib/business-category-catalog";
import { findExactCategory, searchCategories } from "@/lib/category-search";

/**
 * "Alt tür" alanı için kategori arama motoru. İşletme başvurusu ve Sayfa
 * Yöneticisi Paneli aynı bileşeni ve aynı kataloğu kullanır.
 *
 * Geriye dönük uyum: alan hâlâ serbest metin. Katalogda olmayan bir ad
 * yazılırsa o ad kaydedilir (eski işletmelerin "Kahve, pasta" gibi alt
 * türleri olduğu gibi kalır); listeden seçmek yalnız kolaylıktır.
 */
export function CategorySearchField({
  catalog,
  value,
  onChange,
  onPick,
  sectorLabel,
  suggestSector,
  placeholder = "Ör. kasap, kuaför, oto yıkama, diş kliniği",
  required = false,
  inputId,
}: {
  catalog: readonly BusinessCategoryEntry[];
  value: string;
  onChange: (value: string) => void;
  onPick: (entry: BusinessCategoryEntry) => void;
  /** Ana kategori adı (ör. "sac-bakimi" → "Saç bakımı"); yoksa gösterilmez. */
  sectorLabel?: (entry: BusinessCategoryEntry) => string | null;
  /** Kutu boşken bu ana kategoriye bağlı kategoriler önerilir. */
  suggestSector?: string | null;
  placeholder?: string;
  required?: boolean;
  inputId?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const closeTimer = useRef<number | null>(null);

  const trimmed = value.trim();
  const results = useMemo(() => {
    if (trimmed) return searchCategories(catalog, trimmed, 8);
    if (!suggestSector) return [];
    return catalog
      .filter((entry) => entry.sector_slug === suggestSector)
      .slice(0, 8)
      .map((entry) => ({ entry, score: 0, via: null }));
  }, [catalog, trimmed, suggestSector]);
  const exact = useMemo(() => findExactCategory(catalog, trimmed), [catalog, trimmed]);

  const showList = open && (results.length > 0 || trimmed.length > 0);
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  function pick(entry: BusinessCategoryEntry) {
    onPick(entry);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && results.length > 0 ? `${listId}-${activeIndex}` : undefined
          }
          autoComplete="off"
          className="pl-9"
          placeholder={placeholder}
          value={value}
          required={required}
          maxLength={40}
          onChange={(event) => {
            onChange(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            if (closeTimer.current) window.clearTimeout(closeTimer.current);
            setOpen(true);
          }}
          onBlur={() => {
            // Listeye tıklama, odak kaybından sonra işlensin.
            closeTimer.current = window.setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(event) => {
            if (!showList || results.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((activeIndex + 1) % results.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((activeIndex - 1 + results.length) % results.length);
            } else if (event.key === "Enter") {
              // Liste açıkken Enter formu göndermez, vurgulu kategoriyi seçer.
              event.preventDefault();
              const chosen = results[activeIndex];
              if (chosen) pick(chosen.entry);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>

      {showList ? (
        <div
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg"
          onMouseDown={(event) => event.preventDefault()}
        >
          {!trimmed && results.length > 0 ? (
            <p className="px-3 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Önerilen
            </p>
          ) : null}
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {results.map((result, index) => {
              const sector = sectorLabel?.(result.entry) ?? null;
              return (
                <li
                  key={result.entry.slug}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`cursor-pointer px-3 py-2 ${index === activeIndex ? "bg-muted" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(result.entry)}
                >
                  <span className="block text-sm font-medium">{result.entry.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {result.entry.group_name}
                    {sector ? ` · Ana kategori: ${sector}` : ""}
                    {result.via ? ` · “${result.via}”` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          {trimmed && !exact ? (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              {results.length === 0 ? "Eşleşen kategori yok. " : "Listede yoksa "}
              yazdığınız “{trimmed}” kullanılır.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
