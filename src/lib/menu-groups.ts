/** Kategori → ürün gruplaması. Akordeonun (CategoryAccordion) veri tarafı. */
export type CategoryGroup<T> = {
  id: string;
  name: string;
  items: T[];
};

/**
 * Ürünleri kategorilerine dağıtır. Kategori sırası verilen listeyle aynı
 * kalır; kategorisi olmayan ürünler en sona "Kategorisiz" altında toplanır.
 * Boş kategoriler gösterilmez — 26 kategorili bir markette boş başlıklar
 * listeyi sulandırıyor.
 */
export function groupByCategory<T extends { category_id?: string | null }>(
  items: T[],
  categories: { id: string; name: string }[],
  uncategorisedLabel = "Kategorisiz",
): CategoryGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const category of categories) buckets.set(category.id, []);
  const loose: T[] = [];

  for (const item of items) {
    const bucket = item.category_id ? buckets.get(item.category_id) : undefined;
    if (bucket) bucket.push(item);
    else loose.push(item);
  }

  const groups = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      items: buckets.get(category.id) ?? [],
    }))
    .filter((group) => group.items.length > 0);

  if (loose.length > 0) {
    groups.push({ id: "__uncategorised__", name: uncategorisedLabel, items: loose });
  }
  return groups;
}
