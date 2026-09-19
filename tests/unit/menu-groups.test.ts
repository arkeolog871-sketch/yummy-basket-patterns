import { describe, expect, it } from "vitest";
import { groupByCategory } from "@/lib/menu-groups";

type Item = { id: string; category_id: string | null };

const categories = [
  { id: "c1", name: "İçecekler" },
  { id: "c2", name: "Atıştırmalık" },
  { id: "c3", name: "Temizlik" },
];

describe("kategori → ürün gruplaması", () => {
  it("ürünleri kategorilerine dağıtır ve kategori sırasını korur", () => {
    const items: Item[] = [
      { id: "a", category_id: "c2" },
      { id: "b", category_id: "c1" },
      { id: "c", category_id: "c2" },
    ];
    const groups = groupByCategory(items, categories);
    expect(groups.map((group) => group.name)).toEqual(["İçecekler", "Atıştırmalık"]);
    expect(groups[0]!.items.map((item) => item.id)).toEqual(["b"]);
    expect(groups[1]!.items.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("boş kategoriyi göstermez", () => {
    // 26 kategorili bir markette boş başlıklar listeyi sulandırıyor.
    const groups = groupByCategory([{ id: "a", category_id: "c3" }], categories);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.name).toBe("Temizlik");
  });

  it("kategorisiz ürünleri en sona toplar", () => {
    const items: Item[] = [
      { id: "a", category_id: null },
      { id: "b", category_id: "c1" },
    ];
    const groups = groupByCategory(items, categories);
    expect(groups.map((group) => group.name)).toEqual(["İçecekler", "Kategorisiz"]);
    expect(groups[1]!.items.map((item) => item.id)).toEqual(["a"]);
  });

  it("silinmiş bir kategoriye bağlı ürünü düşürmez", () => {
    // Kategori silinip ürünler kalırsa vitrinde görünmeye devam etmeli.
    const groups = groupByCategory([{ id: "a", category_id: "yok" }], categories);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.name).toBe("Kategorisiz");
    expect(groups[0]!.items.map((item) => item.id)).toEqual(["a"]);
  });

  it("kategorisiz başlığı değiştirilebilir (vitrinde 'Diğer')", () => {
    const groups = groupByCategory([{ id: "a", category_id: null }], categories, "Diğer");
    expect(groups[0]!.name).toBe("Diğer");
  });

  it("hiç ürün yoksa boş dizi döner", () => {
    expect(groupByCategory([] as Item[], categories)).toEqual([]);
  });

  it("5.000 ürünü tek geçişte dağıtır", () => {
    // Eski hal her kategori için tüm ürünleri tarıyordu (O(kategori × ürün)).
    const many: Item[] = Array.from({ length: 5000 }, (_, index) => ({
      id: `p${index}`,
      category_id: categories[index % 3]!.id,
    }));
    const groups = groupByCategory(many, categories);
    expect(groups).toHaveLength(3);
    expect(groups.reduce((total, group) => total + group.items.length, 0)).toBe(5000);
  });
});
